---
name: data-engineering
description: >
  Apply this skill when designing or reviewing data pipelines, ETL logic, SQL queries, or backend data workflows.
  Emphasizes idempotency, execution-plan awareness, safe DML, and explicit data governance.
license: Internal use — Water Quality Monitoring System Project
---

# Data Engineering Skill
## Use this skill for data pipeline design, SQL/NoSQL queries, and backend data workflows

Even though this project is a web application, any data engineering work should follow strong idempotency and governance rules.
This skill is useful for batch import scripts, backend transformations, and data validation logic.

---

## PERFORMANCE AND IDENTITY GUIDELINES

- Write idempotent pipeline logic: reruns must not duplicate or corrupt data.
- Prefer `UPSERT` / `MERGE` / explicit partition overwrite for upsert-style operations.
- Avoid `SELECT *`. Always specify exact columns needed.
- Push filters down early and avoid unnecessary joins or scan-heavy operations.

---

## SQL / DATA QUERY RULES

- Always preview affected rows before running DML.
  - For example, use a `SELECT` with the same `WHERE` clause before `UPDATE` or `DELETE`.
- Use explicit columns for `SELECT`, `INSERT`, `UPDATE`, and `MERGE`.
- Prefer incremental writes over full table rewrites unless the dataset is intentionally partitioned and small.

### Preview before update example
```sql
SELECT id, status, updated_at
FROM water_samples
WHERE status = 'DANGER'
  AND created_at < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY);
```

### Idempotent upsert example
```sql
MERGE INTO sample_metrics target
USING (SELECT ? AS sample_id, ? AS value) source
ON target.sample_id = source.sample_id
WHEN MATCHED THEN
  UPDATE SET value = source.value, updated_at = CURRENT_TIMESTAMP
WHEN NOT MATCHED THEN
  INSERT (sample_id, value, created_at, updated_at)
  VALUES (source.sample_id, source.value, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

---

## PYSPARK / TRANSFORMATION GUIDELINES

- Avoid `.collect()` or `.toPandas()` unless the dataset is guaranteed tiny.
- Use window functions and vectorized UDFs to avoid exploding memory usage.
- Broadcast small dimension tables where appropriate to reduce shuffle.
- Cache only when reused often and when memory savings outweigh the cost.

### PySpark pattern example
```python
from pyspark.sql import functions as F
from pyspark.sql.window import Window

window = Window.partitionBy('location_id').orderBy(F.desc('created_at'))

latest = (
    samples
    .select('location_id', 'status', 'created_at')
    .withColumn('row_num', F.row_number().over(window))
    .filter(F.col('row_num') == 1)
)
```

> This pattern finds the latest record per location without collecting data locally.

---

## NO-SQL / DOCUMENT GUIDELINES

- Respect the schema-less model and avoid cross-partition scans when possible.
- Use targeted keys or indexed fields for lookups.
- Avoid large scans or unbounded aggregations on document collections.

---

## SAFETY AND GOVERNANCE

- Do not modify production data structures lightly.
- For destructive operations, require a preview query first.
- Document assumptions and key transformation logic clearly.
- Use application-level checks to prevent duplicate writes when writing from batch or API jobs.

---

## WHEN TO APPLY THIS SKILL

- Building or reviewing import/seed scripts.
- Converting raw sensor or image-derived data into structured records.
- Writing SQL that affects existing tables.
- Optimizing backend data access or analytics queries.
