# 智慧化農業管理平台 — static demo

This is a static build of the prototype for 國立屏東科技大學「智慧化農業管理平台」, set at 六堆雅歌園有機教育農場.

Every state, event, route, and recommendation in this demo is simulated. It is a ten-minute, resettable prototype. It is not a farm-operations, monitoring, or diagnosis system, and nothing in it is operational advice.

## Source

- Farm repository commit: `95cc3431588212747392c2dd003e0da1cc8122dc` (x10will/farm `main`).
- DT viewer generation: `embed-abd31987-farm-meshopt-20260927`.
- Build record: `BUILD_INFO.json`, which lists the farm commit, the DT generation, the panel-core pin, the canonical frame hashes, and the meshopt lineage for every GLB.

## Licences and attributions

- Context roads, river, and buildings: © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright).
- Terrain: 內政部 2025 20 m DTM (data.gov.tw dataset 176927), under [政府資料開放授權條款－第1版](https://data.gov.tw/license).
- three.js and @mkkellogg/gaussian-splats-3d: MIT; licences are under `dt/<id>/node_modules/`.
- panel-core: licence unset (owner decision). GridStack: MIT, see `vendor/panel-core/GRIDSTACK_LICENSE.txt`.

Farm field and building outlines are author-created, not surveyed. No aerial imagery ships in this build.
