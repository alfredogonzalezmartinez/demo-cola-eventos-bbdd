# AGENTS.md — demo-cola-eventos-bbdd

Dos apps (app2: Node 26 + Astro SSR; app1: PHP 8.3 + Symfony) publican y consumen una cola de eventos de dominio sobre tablas MySQL (sin broker). El contrato está en `docs/`, no aquí: **este fichero es un router**, carga solo lo necesario para la tarea.

## Regla de carga

Lee `docs/` de forma perezosa y por tarea: empieza por la fila que aplique, y solo añade más ficheros si la tarea lo exige. No vuelvas a transcribir su contenido en código/comentarios: enlaza o referéncialo.

## Router de tareas → docs


| Si la tarea es sobre…                                                    | Lee                              |
| ------------------------------------------------------------------------ | -------------------------------- |
| Entender el objetivo, stack o decisiones técnicas                        | `docs/01-vision-general.md`      |
| El escenario e-commerce (eventos, roles de cada app, flujo completo)     | `docs/02-escenario-demo.md`      |
| Contenedores, BDs, estructura DDD/hexagonal de las apps                  | `docs/03-arquitectura.md`        |
| **Cola de eventos: tablas SQL, payload/naming de eventos, suscriptores** | `docs/04-modelo-eventos.md`      |
| Publicar eventos (publish, outbox, sync del routing)                     | `docs/05-flujo-publicacion.md`   |
| Consumir eventos (cron, SKIP LOCKED, retries, dead letter)               | `docs/06-flujo-consumo.md`       |
| Docker, compose, Makefile, variables, arranque                           | `docs/07-infraestructura.md`     |
| El repo de referencia de Codely (qué copiar 1:1)                         | `docs/08-referencia-codely.md`   |
| Qué hacer ahora y criterios de cierre por fase                           | `docs/09-plan-implementacion.md` |
| Índice de todo lo anterior                                               | `docs/README.md`                 |


## Convenciones vigentes

- Idioma del código y de los commits: commits en inglés (Conventional Commits, skill `codely-git-conventional-commit`), docs en español.
- La cola vive en BD `eventos`; el dominio en `comercio`. MySQL 8.0.40 (TZ UTC) ya está fijado — cualquier cambio pasa por actualizar los docs.
- app2 primero (copia 1:1 de la referencia); app1 replica el modelo en PHP.

- Commits: sólo cuando el usuario lo indique explícitamente; nunca por propia iniciativa. El mensaje lo elige el agente (Conventional Commits en inglés, skill `codely-git-conventional-commit`) sin preguntar — sólo se consulta al usuario si la decisión necesita razonamiento.
- Comentarios en código y ficheros de config: sólo si explican algo no deducible (el *porqué*, decisiones con enlace a la doc del tema, advertencias puntuales). Fuera: referencias a fases del plan, narrativa de progreso o estados ("llegan con la Fase X", "cerrado en la Fase Y") — eso vive en la doc y en `docs/09`.