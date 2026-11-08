# Схема room.json

Все размеры — в сантиметрах. Вид сверху:

```
        N  (дальняя стена, z = 0)
   ┌───────────────────────┐
 W │  x →                  │ E
   │  z ↓                  │
   └───────────────────────┘
        S  (ближняя стена, z = depth)
```

```json
{
  "name": "Спальня",
  "room": { "width": 380, "depth": 340, "height": 270, "confidence": "medium" },
  "walls": { "color": "#F1EEE8" },
  "floor": { "type": "wood", "color": "#B98A5E" },
  "wallNames": { "N": "стена с окном", "S": "стена с дверью" },
  "openings": [
    { "wall": "N", "type": "window", "offset": 210, "width": 130, "height": 150, "sill": 85, "confidence": "medium" },
    { "wall": "S", "type": "door",   "offset": 280, "width": 80,  "height": 205, "confidence": "high" }
  ],
  "items": [
    { "id": "bed", "kind": "bed", "label": "Кровать", "w": 160, "d": 205, "h": 50,
      "x": 130, "z": 103, "rot": 0, "color": "#C9B9A6", "confidence": "high" }
  ],
  "layouts": [
    { "name": "Как сейчас", "items": { "bed": { "x": 130, "z": 103, "rot": 0 } } }
  ],
  "notes": ["Ширина комнаты посчитана по двери 80 см."]
}
```

| Поле | Что это |
|---|---|
| `room.width` | длина стен N и S |
| `room.depth` | длина стен W и E |
| `floor.type` | `wood` (доски) или `plain` |
| `camera.hide` | какие 2 стены спрятать на старте: `SE` (по умолчанию, вид от двери), `SW`, `NE`, `NW` |
| `wallNames` | необязательно: свои названия стен в интерфейсе |
| `openings[].offset` | для N и S — от левой стены W; для W и E — от дальней стены N |
| `openings[].sill` | высота подоконника (только окна) |
| `openings[].curtains` | шторы у окна (по умолчанию есть; `false` — убрать), `curtainColor` — цвет |
| `items[].w / d / h` | ширина (вдоль задней стороны) / глубина (от задней стороны к лицу) / высота |
| `items[].x / z` | центр основания |
| `items[].rot` | к какой стене повёрнута задняя сторона: 0 → N, 90 → E, 180 → S, 270 → W. Только эти 4 значения. Вплотную к стене: rot 0 → z = d/2; 180 → z = depth − d/2; 90 → x = width − d/2; 270 → x = d/2 |
| `items[].elevation` | высота низа над полом, см (полка, ТВ на стене, верхние шкафы). Ставь вплотную к стене |
| `items[].fixed` | `true` — нельзя тащить. По умолчанию закреплены kitchen, radiator и всё с elevation |
| `items[].collide` | `false` — не мешает другим (ковёр по умолчанию) |
| `confidence` | `high` / `medium` / `low` — в таблице «low» помечается «перемерь» |
| `layouts` | 3 варианта; в каждом — новые `x`, `z`, `rot` для нужных предметов |

`kind`: bed, sofa, armchair, wardrobe, dresser, nightstand, cabinet, desk, table, chair, tv, shelf, bookcase, plant, rug, lamp, kitchen, fridge, radiator, mirror, art (картина на стене, с elevation), box (всё остальное; `other` = box).

`openings[].type`: `door` или `window`. Балконная дверь в пол — `door`.

В каждой планировке перечисляй все предметы, кроме ковра.
