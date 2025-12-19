# 性能测试（k6）

该目录包含基于 `k6` 的性能测试脚本，用于对挂号创建接口（`POST /api/registration/create`）进行负载测试。

主要文件：

- `appointment_load_test.js`：模拟大量用户并发提交挂号请求的脚本。

运行方式（推荐使用 Docker 镜像，无需在本机安装 k6）：

```bash
# 使用 Docker 运行（在 Linux/macOS）
docker run --rm -v "$(pwd)":/scripts -w /scripts/loadimpact/k6 loadimpact/k6 run /scripts/backend/test/perf/appointment_load_test.js

# Windows PowerShell（注意路径格式）
docker run --rm -v "${PWD}":/scripts -w /scripts/loadimpact/k6 loadimpact/k6 run /scripts/backend/test/perf/appointment_load_test.js
```

如果在本机已安装 `k6`：

```bash
# 在仓库根目录运行：
k6 run backend/test/perf/appointment_load_test.js
```

可配置的环境变量：
- `BASE_URL`：目标 API 地址（默认 `http://localhost:3000`）
- `K6_VUS`：并发虚拟用户数（默认 50）
- `K6_DURATION`：测试持续时间（默认 `30s`）

示例：使用 100 个 VU 运行 1 分钟：

```bash
BASE_URL=http://localhost:3000 K6_VUS=100 K6_DURATION=1m k6 run backend/test/perf/appointment_load_test.js
```

结果与分析：
- k6 将输出请求速率、响应时间的 p50/p95/p99、以及阈值（如果设置）。
- 若发现 `http_req_failed` 超过阈值或 p95 超出预期，需进一步分析后端瓶颈（数据库锁、事务时间、MQ 消息堆积等）。
