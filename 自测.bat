@echo off
chcp 65001 >nul
cd /d %~dp0
echo ===== 欢洋生活 一键全量自测 ======
echo.
echo [1/4] JS 语法检查（node --check）
set FAIL=0
for /r %%f in (*.js) do (
  echo %%f | findstr /i node_modules >nul && goto :skipjs
  node --check %%f 2>nul || (echo FAIL: %%f & set FAIL=1)
  :skipjs
)
if "%FAIL%"=="1" (echo   语法检查有失败!) else (echo   全部通过)
echo.
echo [2/4] WXML 标签平衡校验
node tests/wxml-check.js
echo.
echo [3/4] 单元测试
node tests/run-tests.js
echo.
echo [4/4] 完成。确认无误后：开发者工具重新编译 + 小程序后台选体验版
echo 版本号见 miniprogram\app.js
echo.
pause