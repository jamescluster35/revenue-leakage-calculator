$lines = Get-Content Email_PDF_Templates.gs
$part1 = $lines[0..52]
$part3 = $lines[350..($lines.Length - 1)]
$newTemplate = Get-Content new_template.js -Raw

$result = ($part1 -join [Environment]::NewLine) + [Environment]::NewLine + $newTemplate + [Environment]::NewLine + ($part3 -join [Environment]::NewLine)
Set-Content Email_PDF_Templates.gs -Value $result
Remove-Item new_template.js
