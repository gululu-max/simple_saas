# rename-scenes.ps1
# 批量重命名场景库图片为 snake_case 格式

$SourceDir = "public/scene-library"

if (-not (Test-Path $SourceDir)) {
    Write-Host "[错误] 目录不存在: $SourceDir" -ForegroundColor Red
    Write-Host "       请先把图片放到 public/scene-library/ 目录下" -ForegroundColor Yellow
    exit 1
}

# 定义重命名规则（旧前缀 -> 新前缀）
$renameMap = @{
    "Art Gallery_"          = "art_gallery_"
    "Beach_"                = "beach_"
    "Bookstore_"            = "bookstore_"
    "City Street_"          = "city_street_"
    "Cozy Home_"            = "cozy_home_"
    "Golden Hour Rooftop_"  = "golden_hour_rooftop_"
    "Gym_"                  = "gym_"
    "Home Kitchen_"         = "home_kitchen_"
    "Outdoor Park_"         = "outdoor_park_"
    "ship_"                 = "ship_"
    "Travel Landmark_"      = "travel_landmark_"
    "Urban Cafe_"           = "urban_cafe_"
    "Urban Café_"           = "urban_cafe_"
    "Waterfront_"           = "waterfront_"
    "Wine Bar_"             = "wine_bar_"
}

# 扫描文件并生成重命名计划
$plan = @()
Get-ChildItem -Path $SourceDir -File | ForEach-Object {
    $oldName = $_.Name
    $newName = $null

    foreach ($oldPrefix in $renameMap.Keys) {
        if ($oldName.StartsWith($oldPrefix)) {
            $newPrefix = $renameMap[$oldPrefix]
            $rest = $oldName.Substring($oldPrefix.Length)
            if ($rest -match '^(\d+)(\.\w+)$') {
                $num = [int]$matches[1]
                $ext = $matches[2].ToLower()
                $newName = ("{0}{1:D2}{2}" -f $newPrefix, $num, $ext)
            }
            break
        }
    }

    if ($newName -and $newName -ne $oldName) {
        $plan += [PSCustomObject]@{
            Old = $oldName
            New = $newName
        }
    }
}

if ($plan.Count -eq 0) {
    Write-Host "[OK] 没有需要重命名的文件（可能已经是 snake_case 格式了）" -ForegroundColor Green
    exit 0
}

# 预览
Write-Host ""
Write-Host "[预览] 重命名计划 (共 $($plan.Count) 个文件):" -ForegroundColor Cyan
Write-Host ""
$plan | ForEach-Object {
    Write-Host "  $($_.Old)" -ForegroundColor Yellow -NoNewline
    Write-Host "  ->  " -NoNewline
    Write-Host "$($_.New)" -ForegroundColor Green
}

Write-Host ""
$confirm = Read-Host "确认执行重命名? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "[取消] 已取消" -ForegroundColor Red
    exit 0
}

# 执行
$successCount = 0
$failCount = 0
foreach ($item in $plan) {
    $oldPath = Join-Path $SourceDir $item.Old
    $newPath = Join-Path $SourceDir $item.New
    try {
        Rename-Item -Path $oldPath -NewName $item.New -ErrorAction Stop
        $successCount++
        Write-Host "  [OK] $($item.Old) -> $($item.New)" -ForegroundColor Green
    } catch {
        $failCount++
        Write-Host "  [失败] $($item.Old): $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[完成] $successCount 成功, $failCount 失败" -ForegroundColor Cyan