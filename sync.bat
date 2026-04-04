@echo off
:: 同步本地修改到 GitHub Pages
:: 用法: 修改文件后双击此文件，或在此目录运行 sync.bat

cd /d "%~dp0"
echo [1/3] 同步 ziwei.html → index.html ...
copy /Y ziwei.html index.html > nul

echo [2/3] 提交本地更改 ...
git add index.html rules/rule2_data.js rules/rules_ziquan.md rules/rules_ziquan_compact.md rules/rules_jingcheng_compact.md memory_log.md
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "更新排盘系统 %date% %time:~0,5%"
) else (
    echo 没有新变更需要提交
)

echo [3/3] 推送到 GitHub Pages ...
git push origin main

echo.
echo 完成！约 1 分钟后生效：https://hugh1ezy.github.io/ziwei/
pause
