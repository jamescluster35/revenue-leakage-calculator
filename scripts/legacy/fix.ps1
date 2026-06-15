$content = Get-Content Email_PDF_Templates.gs -Raw
$content = $content.Replace("\`", "`")
$content = $content.Replace("\`$", "`$")
Set-Content Email_PDF_Templates.gs -Value $content
