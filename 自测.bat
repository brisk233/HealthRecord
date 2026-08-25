@echo off
chcp 65001 >nul
cd /d %~dp0
echo ===== 欢洋生活 一键自测 ======
echo.
echo [1/3] JS 语法检查（node --check）
for /r %%f in (*.js) do (
  echo %%f | findstr /i node_modules >nul && goto :skipjs
  node --check %%f 2>nul || echo FAIL: %%f
  :skipjs
)
echo [2/3] 单元测试
node tests/run-tests.js
echo.
echo [3/3] 提示：请确认开发者工具已重新编译 + 手机上为最新体验版
echo 版本号可在「我的」页底部查看，当前代码版本见 miniprogram\app.js
echo.
pause
