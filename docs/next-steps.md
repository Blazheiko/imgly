# Наступні кроки — imgly-editor

## Кроки редагування (з `docs/roadmap.md`)

| # | Крок | Статус |
|---|---|---|
| 3 | Експорт у PNG / JPEG / WebP | idea |
| 4 | Обрізка й поворот на 90° | idea |
| 5 | Яскравість, контраст, насиченість та інші корекції | idea |
| 6 | Пензель і гумка | idea |
| 7 | Скасування та повтор дій | idea |

## Конвеєр SDD (на прикладі експорту)

 ```
/sdd:specify export          → spec.md: історії, AC, NFR; тут же визначиться розмір (S) і маршрут
/sdd:clarify export          → закриває неоднозначності, зокрема D4
/sdd:design export           → SAD + ADR (де живе encoder: src/render/, як зберігається файл)
/sdd:plan-tests export       → тест-план (завантаження файлу й кодування перевіряє e2e)
/sdd:tasks export            → tasks.json
/sdd:implement export        → TDD по задачах
/sdd:review export → /sdd:ship export
```

Для фічі розміру S маршрут, найімовірніше, буде `quick`. Тоді частина кроків стиснеться: тест-план,
наприклад, вбудується прямо в `spec.md`. Це вирішить `classify-size` на старті `specify`.
