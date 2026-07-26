# Performance report

Measured values and environment are stored in `PERFORMANCE_BASELINE.json`.

- The source-path listener audit changed the 100-bookmark case from 104 permanent item-level document listeners to zero. A single menu-scoped listener exists only while that menu is open.
- On the recorded machine, indexing 10,000 search documents took 79.08 ms and a capped query took 2.41 ms.
- Balanced uses one workspace backdrop and no per-Board backdrop filter. Low Power uses solid surfaces and disables filters/scale/smooth scrolling.

GPU/raster and representative low-end Windows heap traces are unavailable, so this report does not claim a measured GPU percentage or universal frame-rate improvement.
