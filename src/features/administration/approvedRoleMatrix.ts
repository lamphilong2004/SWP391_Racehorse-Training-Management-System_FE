/** Read-only documentation transcribed from approved Figma 290:3537. Not an authorization engine. */
export const CORE_ROLE_MATRIX = [
  {
    "id": "MF-01",
    "feature": "Hồ sơ ngựa, quyền sở hữu & phả hệ",
    "access": [
      "V C E D",
      "V",
      "V (được phân công)",
      "—",
      "V",
      "V",
      "V (của mình)"
    ]
  },
  {
    "id": "MF-02",
    "feature": "Tình trạng sức khỏe & hồ sơ y tế",
    "access": [
      "V",
      "V (tóm tắt)",
      "V (tóm tắt, được phân công)",
      "—",
      "V C E",
      "V + X (công việc được giao)",
      "V (của mình · trạng thái, cân nặng, tóm tắt)"
    ]
  },
  {
    "id": "MF-03",
    "feature": "Vị trí chấn thương & theo dõi hồi phục",
    "access": [
      "V",
      "V (tóm tắt)",
      "V (tóm tắt, được phân công)",
      "—",
      "V C E",
      "—",
      "V (của mình · tình trạng hồi phục)"
    ]
  },
  {
    "id": "MF-04",
    "feature": "Quản lý chương trình huấn luyện",
    "access": [
      "V",
      "V C E D · mẫu chương trình · duyệt yêu cầu điều chỉnh",
      "V (được phân công) · xem mẫu chương trình · C yêu cầu điều chỉnh",
      "—",
      "V",
      "V",
      "V (của mình)"
    ]
  },
  {
    "id": "MF-05",
    "feature": "Lịch tập & phân công nhân sự",
    "access": [
      "V",
      "V (chỉ xem)",
      "V C E D (được phân công)",
      "V + X (được phân công)",
      "V",
      "V + X (buổi tập cần kiểm tra trước)",
      "V (của mình)"
    ]
  },
  {
    "id": "MF-06",
    "feature": "Kết quả tập & đánh giá thành tích",
    "access": [
      "V",
      "V (chỉ xem)",
      "V C E (được phân công)",
      "V + C (được phân công)",
      "V",
      "—",
      "V (của mình)"
    ]
  },
  {
    "id": "MF-07",
    "feature": "Giám sát tập luyện trực tiếp & cảnh báo",
    "access": [
      "V",
      "V (chỉ xem)",
      "V + X (được phân công)",
      "C (được phân công · nguồn dữ liệu)",
      "V + X (xác nhận cảnh báo NGHIÊM TRỌNG)",
      "—",
      "—"
    ]
  },
  {
    "id": "MF-08",
    "feature": "Hạn chế tập luyện y tế / Khóa tập luyện",
    "access": [
      "V",
      "V (hạn chế + lý do)",
      "V (hạn chế + lý do, được phân công)",
      "V (hạn chế + lý do, được phân công)",
      "V C E · người duy nhất được ghi",
      "V",
      "V (của mình · chỉ mức sẵn sàng)"
    ]
  },
  {
    "id": "MF-12",
    "feature": "Báo cáo sự cố chuồng trại",
    "access": [
      "V",
      "V C",
      "V C (được phân công)",
      "V C (được phân công)",
      "V + E (trạng thái xử lý)",
      "V C",
      "—"
    ]
  },
  {
    "id": "MF-15",
    "feature": "Cổng thông tin Horse Owner",
    "access": [
      "V (hỗ trợ)",
      "—",
      "—",
      "—",
      "—",
      "—",
      "V (của mình)"
    ]
  },
  {
    "id": "MF-17",
    "feature": "Quản lý nhân sự & người dùng",
    "access": [
      "V C E D",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—"
    ]
  },
  {
    "id": "MF-18",
    "feature": "Phân quyền theo vai trò",
    "access": [
      "V E (gán vai trò)",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—"
    ]
  },
  {
    "id": "MF-19",
    "feature": "Tổng quan & báo cáo quản lý",
    "access": [
      "V (quản lý)",
      "V (huấn luyện, toàn câu lạc bộ)",
      "V (buổi tập của mình)",
      "—",
      "V (sức khỏe đàn ngựa)",
      "—",
      "—"
    ]
  },
  {
    "id": "MF-20",
    "feature": "Nhật ký hệ thống & theo dõi hoạt động",
    "access": [
      "V",
      "—",
      "—",
      "—",
      "—",
      "—",
      "—"
    ]
  }
] as const;
