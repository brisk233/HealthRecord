# 全流程测试 Bug 清单（2026-08-25）

| 编号 | 模块 | 严重度 | 描述 | 复现路径 | 修复 |
| --- | --- | --- | --- | --- | --- |
| BUG-001 | 健身·云合并 | 中高 | mergeProfile 只保留 male/female 字段，档案根级 trainOrder 被丢弃，健身课表拖拽排序在任意云端合并后丢失，无法跨页/重启保留 | 健身页拖拽换序→保存；切页触发 pullHome 合并 | ✅ 已修复：合并时保留档案根级字段（trainOrder 等） |
| BUG-002 | 冰箱·云同步 | 中 | “吃掉了/新入库”的竞态防护仅本页生效，且原实现用毫秒时间戳，同一毫秒内连续操作会失效；切到菜单/今日页拉取云端旧冰箱会复活已吃食材、覆盖新入库 | 冰箱页吃掉食材→立即切菜单页→旧数据返回 | ✅ 已修复：全局单调序号 + 推送确认（pushFridge/fridgeSyncClean），冰箱/菜单/今日三页统一防护 |
| BUG-003 | 测试基建 | 低 | 冰箱竞态测试的 resolve 返回形状错误（多包一层 ok/data），用例“假通过”，未真正覆盖竞态逻辑 | 原 tests/run-tests.js | ✅ 已修复：改为真实返回形状，并新增跨页竞态用例 |
| BUG-004 | 云函数 push | 严重（历史反复根因） | family 云函数 push 用普通 update 写档案：云端文档 profile 初始为 null，首次写入对象时报 “Cannot create field 'active' in element {profile: null}”，导致档案/冰箱**从未同步到云端**——退出登录→重新登录自然恢复不了（“生活方式不持久化”反复出现的真根因） | 模拟器实测：本地保存成功→重启仍在→退出→重登后云端 profile=null，恢复为空 | ✅ 已修复：push 改用 db.command.set() 整体替换 profile/fridge/menuOverride，并已通过 CLI 部署 family 函数到 cloudbase-d1glhkgunaf107df5 |

> 回归：修复后 tests/run-tests.js 41/41 通过；BUG-004 在真实模拟器+真实云端完整回放通过（修改→推送落盘→重启→退出→重登恢复），测试后已恢复用户原始档案与冰箱数据并同步云端。
