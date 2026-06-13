with open('Email_PDF_Templates.gs', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('\\`', '`')
text = text.replace('\\${', '${')

with open('Email_PDF_Templates.gs', 'w', encoding='utf-8') as f:
    f.write(text)
