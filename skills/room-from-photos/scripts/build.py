#!/usr/bin/env python3
"""Собирает один HTML-файл 3D-комнаты из room.json.

  python3 <папка скилла>/scripts/build.py room.json -o my-room.html

Ошибки (сборка останавливается): нет нужных полей, размеры не числа или ≤ 0,
rot не кратен 90, дубли id, неизвестная стена у проёма.
Предупреждения (сборка идёт, но лучше исправить): предмет за стеной, пересечения,
мебель в зоне открывания двери, неполная планировка. Исправь room.json и собери снова.
"""
import argparse, json, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
KINDS = {"bed", "sofa", "armchair", "wardrobe", "dresser", "nightstand", "cabinet", "desk", "table", "chair",
         "tv", "shelf", "bookcase", "plant", "rug", "lamp", "box", "other", "kitchen", "fridge", "radiator", "mirror", "art"}
errors, warns = [], []


def num(v, where, positive=True):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        errors.append(f"{where}: должно быть числом (см), сейчас {v!r}")
        return None
    if positive and v <= 0:
        errors.append(f"{where}: должно быть больше нуля, сейчас {v}")
        return None
    return v


def footprint(it, x, z, rot):
    swap = (rot // 90) % 2 == 1
    fw, fd = (it["d"], it["w"]) if swap else (it["w"], it["d"])
    return (x - fw / 2, x + fw / 2, z - fd / 2, z + fd / 2)


def overlap(a, b, gap=1):
    return a[0] < b[1] - gap and a[1] > b[0] + gap and a[2] < b[3] - gap and a[3] > b[2] + gap


def collides(it):
    if "collide" in it:
        return bool(it["collide"])
    return it.get("kind") != "rug" and not it.get("elevation")


def check(data):
    if not isinstance(data, dict):
        errors.append("room.json должен быть объектом { ... }")
        return
    r = data.get("room")
    if not isinstance(r, dict):
        errors.append("нет блока room {width, depth, height}")
        return
    W = num(r.get("width"), "room.width"); D = num(r.get("depth"), "room.depth")
    if r.get("height") is not None:
        num(r.get("height"), "room.height")
    if W is None or D is None:
        return

    doors = []
    ops = data.get("openings") or []
    if not isinstance(ops, list):
        errors.append("openings должен быть списком"); ops = []
    for i, o in enumerate(ops):
        where = f"openings[{i}]"
        if o.get("wall") not in ("N", "S", "W", "E"):
            errors.append(f"{where}.wall: N, S, W или E"); continue
        if o.get("type") not in ("door", "window"):
            errors.append(f"{where}.type: door или window (балконная дверь — door)"); continue
        off = num(o.get("offset"), f"{where}.offset", positive=False)
        w = num(o.get("width"), f"{where}.width"); h = num(o.get("height"), f"{where}.height")
        if None in (off, w, h):
            continue
        L = W if o["wall"] in ("N", "S") else D
        if off < 0 or off + w > L:
            errors.append(f"{where}: проём {off}…{off + w} см не помещается на стене {o['wall']} длиной {L} см")
        if o["type"] == "window" and isinstance(r.get("height"), (int, float)) and o.get("sill", 90) + h > r["height"]:
            errors.append(f"{where}: окно (подоконник {o.get('sill', 90)} + высота {h}) выше потолка {r['height']} см")
        if o["type"] == "door" and isinstance(r.get("height"), (int, float)) and h > r["height"]:
            errors.append(f"{where}: дверь выше потолка")
        if o["type"] == "door":
            a, b = off, off + w
            doors.append({"N": (a, b, 0, w), "S": (a, b, D - w, D), "W": (0, w, a, b), "E": (W - w, W, a, b)}[o["wall"]])

    items = data.get("items") or []
    if not isinstance(items, list):
        errors.append("items должен быть списком"); return
    byid = {}
    for i, it in enumerate(items):
        iid = it.get("id", f"#{i}")
        for k in ("id", "label", "w", "d", "h", "x", "z"):
            if k not in it:
                errors.append(f"{iid}: нет поля {k}")
        if iid in byid:
            errors.append(f"повторяется id «{iid}»")
        ok = all(num(it.get(k), f"{iid}.{k}") is not None for k in ("w", "d", "h"))
        ok = ok and all(num(it.get(k), f"{iid}.{k}", positive=False) is not None for k in ("x", "z"))
        rot = it.get("rot", 0)
        if isinstance(rot, bool) or not isinstance(rot, (int, float)) or rot % 90 != 0:
            errors.append(f"{iid}.rot: только 0, 90, 180 или 270, сейчас {rot!r}"); ok = False
        if it.get("kind", "box") not in KINDS:
            warns.append(f"{iid}: неизвестный kind «{it.get('kind')}» — нарисую коробкой")
        if ok:
            it["rot"] = int(rot) % 360
            byid[iid] = it

    def place_check(name, pos):
        fps = {}
        for iid, it in byid.items():
            x, z, rot = pos.get(iid, (it["x"], it["z"], it["rot"]))
            f = footprint(it, x, z, rot)
            if f[0] < -1 or f[2] < -1 or f[1] > W + 1 or f[3] > D + 1:
                warns.append(f"{name}: «{it['label']}» выходит за стены (x {f[0]:.0f}…{f[1]:.0f}, z {f[2]:.0f}…{f[3]:.0f}; комната {W}×{D})")
            if collides(it):
                fps[iid] = f
                for dz in doors:
                    if overlap(f, dz):
                        warns.append(f"{name}: «{it['label']}» стоит в зоне открывания двери")
        ids = list(fps)
        for a in range(len(ids)):
            for b in range(a + 1, len(ids)):
                if overlap(fps[ids[a]], fps[ids[b]]):
                    warns.append(f"{name}: пересекаются «{byid[ids[a]]['label']}» и «{byid[ids[b]]['label']}»")

    place_check("исходная расстановка", {})
    layouts = data.get("layouts") or []
    if not layouts:
        warns.append("нет layouts — кнопок планировок не будет")
    movable = [i for i, it in byid.items() if collides(it) and not it.get("fixed", it.get("kind") in ("radiator", "kitchen"))]
    for L in layouts:
        name = f"планировка «{L.get('name', '?')}»"
        pos = {}
        for iid, p in (L.get("items") or {}).items():
            if iid not in byid:
                warns.append(f"{name}: нет предмета {iid}"); continue
            it = byid[iid]
            rot = p.get("rot", it["rot"])
            if not isinstance(rot, (int, float)) or rot % 90:
                errors.append(f"{name}: {iid}.rot только 0/90/180/270"); continue
            pos[iid] = (p.get("x", it["x"]), p.get("z", it["z"]), int(rot) % 360)
        missing = [i for i in movable if i not in (L.get("items") or {})]
        if missing:
            warns.append(f"{name}: не указаны {', '.join(missing)} — останутся там, где были до переключения; лучше перечисли все предметы")
        place_check(name, pos)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("room_json")
    ap.add_argument("-o", "--out", default="room.html")
    a = ap.parse_args()
    try:
        data = json.loads(pathlib.Path(a.room_json).read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"Ошибка: room.json — неверный JSON: {e}"); sys.exit(1)
    check(data)
    for w in dict.fromkeys(warns):
        print("Внимание:", w)
    if errors:
        for e in errors:
            print("Ошибка:", e)
        print("Сборка остановлена. Исправь room.json и запусти снова."); sys.exit(1)
    tpl = (ROOT / "template" / "template.html").read_text(encoding="utf-8")
    eng = (ROOT / "template" / "engine.js").read_text(encoding="utf-8")
    js = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    title = str(data.get("name", "Моя комната")).replace("<", "").replace("&", "и")
    html = tpl.replace("__TITLE__", title).replace("__ROOM_JSON__", js).replace(
        "<script>__ENGINE_JS__</script>", "<script>" + eng.replace("</script", "<\\/script") + "</script>")
    pathlib.Path(a.out).write_text(html, encoding="utf-8")
    print(f"Готово: {a.out} ({len(html) // 1024} КБ). {'Есть предупреждения — лучше исправить. ' if warns else ''}Открой файл в браузере.")


if __name__ == "__main__":
    main()
