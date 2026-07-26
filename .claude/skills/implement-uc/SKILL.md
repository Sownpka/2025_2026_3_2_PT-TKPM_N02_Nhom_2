---
name: implement-uc
description: >
  Triển khai một hoặc nhiều Use Case (UC) của PiCore — Hệ thống Quản lý Phòng tập Pilates.
  Điều phối agent team: backend-dev (Spring Boot) + frontend-dev (React/TS) + qa-verifier.
  Dùng khi người dùng yêu cầu: "implement UC...", "xây UC...", "làm UC...", "code UC...",
  "xây module...", "phát triển tính năng...", "triển khai...", "xây dựng chức năng...",
  hoặc đề cập tên chức năng như "đăng nhập", "quản lý hội viên", "đặt lịch", "điểm danh",
  "quản lý lớp học", "gói tập", "tài chính", "thiết bị", "huấn luyện viên".
  Cũng dùng khi: "làm lại UC...", "sửa UC...", "cập nhật UC...", "tiếp tục UC...",
  "fix backend UC...", "fix frontend UC...", "cải thiện UC...", "bổ sung UC...".
---

# implement-uc — PiCore Orchestrator

Điều phối agent team 3 người để implement từng UC của PiCore theo pipeline:
**backend-dev → frontend-dev → qa-verifier**

## Thực thi mode: Agent Team (Pipeline)

| Agent | Vai trò | Output |
|-------|---------|--------|
| `backend-dev` | Spring Boot module (Entity, Repo, Service, Controller, DTO) | `_workspace/backend_{uc_id}_done.md` |
| `frontend-dev` | React pages, stores, API client | `_workspace/frontend_{uc_id}_done.md` |
| `qa-verifier` | Kiểm tra shape, business rules, labels, permissions | `_workspace/qa_{uc_id}_report.md` |

## Phase 0: Context Check

Trước khi làm bất cứ điều gì, kiểm tra:

1. `D:\Pi-core\_workspace\` có tồn tại không?
2. `D:\Pi-core\backend\` và `D:\Pi-core\frontend\` đã scaffold chưa?
3. UC được yêu cầu đã có `_workspace/backend_{uc_id}_done.md` chưa?

**Phân nhánh:**
- Backend/frontend chưa tồn tại → Thông báo user cần scaffold project trước theo hướng dẫn mục 2 trong CLAUDE.md. Hỏi xem có muốn scaffold ngay không (nếu có, làm thủ công trước khi chạy agents).
- `_workspace/backend_{uc_id}_done.md` đã tồn tại + user yêu cầu "làm lại" / "fix frontend" / "sửa" → Partial re-run: xác định phase cần chạy lại, bỏ qua phase đã xong.
- Chưa có workspace cho UC này → Full run từ Phase 1.

## Phase 1: Parse UC Spec

Đọc `D:\Pi-core\CLAUDE.md` và trích xuất cho UC được yêu cầu:
- ID UC và tên chức năng
- Vai trò được phép (từ mục 3)
- Luồng cơ bản + luồng phụ S-x + luồng thay thế E-x (từ mục 4)
- Thông báo lỗi tiếng Việt (trích nguyên văn)
- API endpoints liên quan (từ mục 8)
- Data model tables liên quan (từ mục 7)
- Business rules liên quan (từ mục 5)

Tạo `D:\Pi-core\_workspace\spec_{uc_id}.md` làm tài liệu tham chiếu chung cho cả team.

## Phase 2: Thành lập Agent Team

```
TeamCreate(
  team_name: "picore-uc-team",
  members: [
    {
      name: "backend-dev",
      agent_type: "backend-dev",
      model: "opus",
      prompt: "Implement backend cho {uc_id}. Đọc D:\\Pi-core\\_workspace\\spec_{uc_id}.md để lấy spec. Đọc CLAUDE.md mục 4, 7, 8. Project tại D:\\Pi-core\\backend\\. Sau khi xong ghi _workspace/backend_{uc_id}_done.md rồi SendMessage tới frontend-dev."
    },
    {
      name: "frontend-dev",
      agent_type: "frontend-dev",
      model: "opus",
      prompt: "Implement frontend cho {uc_id}. Đọc D:\\Pi-core\\_workspace\\spec_{uc_id}.md. Đọc CLAUDE.md mục 4, 6. Project tại D:\\Pi-core\\frontend\\. Chờ signal từ backend-dev trước khi bắt đầu. Sau khi xong ghi _workspace/frontend_{uc_id}_done.md rồi SendMessage tới qa-verifier."
    },
    {
      name: "qa-verifier",
      agent_type: "qa-verifier",
      model: "opus",
      prompt: "Verify tích hợp UC {uc_id}. Đọc D:\\Pi-core\\_workspace\\spec_{uc_id}.md. Project tại D:\\Pi-core\\. Chờ signal từ frontend-dev trước khi bắt đầu. Sau khi xong ghi _workspace/qa_{uc_id}_report.md rồi SendMessage tới leader."
    }
  ]
)
```

## Phase 3: Đăng ký Tasks (với dependencies)

```
TaskCreate(tasks: [
  {
    title: "Backend: {uc_id}",
    description: "Implement Spring Boot module cho {uc_id}",
    assignee: "backend-dev"
  },
  {
    title: "Frontend: {uc_id}",
    description: "Implement React pages/stores/API cho {uc_id}",
    assignee: "frontend-dev",
    depends_on: ["Backend: {uc_id}"]
  },
  {
    title: "QA: {uc_id}",
    description: "Verify backend ↔ frontend integration cho {uc_id}",
    assignee: "qa-verifier",
    depends_on: ["Backend: {uc_id}", "Frontend: {uc_id}"]
  }
])
```

Team tự chạy. Orchestrator (leader) theo dõi qua TaskGet, can thiệp khi cần.

## Phase 4: Monitor & Can thiệp

- Khi backend-dev xong → ghi `_workspace/backend_{uc_id}_done.md` → SendMessage frontend-dev
- Khi frontend-dev xong → ghi `_workspace/frontend_{uc_id}_done.md` → SendMessage qa-verifier
- Khi qa-verifier xong → SendMessage về leader (orchestrator)
- Nếu agent bị stuck > 5 phút: SendMessage hỏi status, nếu cần giao việc cho agent khác

**Lưu ý đặc biệt theo UC:**
- UC1.1/UC1.2: backend-dev cần tạo JWT, BCrypt, lockout logic
- UC3.2: backend-dev PHẢI ghi `package_transaction`
- UC5.1/UC5.2: backend-dev PHẢI dùng transaction + lock cho booking
- UC6.1: frontend-dev dùng Recharts cho biểu đồ so sánh

## Phase 5: Tổng kết

Sau khi nhận signal từ qa-verifier:
1. Đọc `_workspace/qa_{uc_id}_report.md`
2. TeamDelete để giải phóng team
3. Báo cáo cho user:
   - Danh sách files đã tạo (backend + frontend)
   - API endpoints mới
   - **Issues từ QA** (nếu có) — nêu cụ thể file:line và gợi ý fix
   - Definition of Done checklist (CLAUDE.md mục 10): tick những gì đã xong

## Thứ tự UC (theo phụ thuộc dữ liệu)

```
UC1.1 → UC1.2 → UC2.1 → UC3.1 → UC3.2 → UC4.2 → UC4.3 → UC4.1
→ UC2.2 → UC5.1 → UC5.2 → UC5.3 → UC5.4 → UC4.4 → UC5.5 → UC6.1
```

Nếu user yêu cầu một UC mà UC trước đó chưa làm, cảnh báo về dependency trước.

## Error Handling

| Tình huống | Xử lý |
|-----------|-------|
| Agent không tạo được workspace file | Leader đọc trực tiếp code và tạo file thay |
| QA báo FAIL | Báo issues cho user, hỏi có muốn fix ngay không (gọi agent tương ứng) |
| Agent bị stuck | SendMessage hỏi status → 1 retry → báo user nếu vẫn fail |
| Backend/frontend chưa scaffold | Dừng, hướng dẫn user scaffold trước |

## Test Scenarios

### Scenario 1 — Full run
Input: "implement UC1.1 — màn hình đăng nhập"
Kết quả mong đợi:
- `_workspace/spec_UC1.1.md` tạo xong
- Team 3 người được tạo, tasks với dependencies được đăng ký
- backend-dev tạo `AuthController`, `AuthService`, `LoginRequest` record, JWT logic
- frontend-dev tạo `src/pages/Login.tsx` với UI theo Hình 9, màu teal `#0D9488`
- qa-verifier xác nhận `LoginResponse` TS type khớp JWT response, thông báo lỗi tiếng Việt đúng
- User nhận report: files tạo + QA status

### Scenario 2 — Partial re-run
Input: "fix frontend UC2.1, backend đã xong rồi"
Kết quả mong đợi:
- Phase 0: phát hiện `_workspace/backend_UC2.1_done.md` tồn tại
- Chỉ spawn `frontend-dev` + `qa-verifier` (bỏ qua backend-dev)
- frontend-dev đọc workspace file cũ, re-implement frontend
- qa-verifier verify lại toàn bộ
