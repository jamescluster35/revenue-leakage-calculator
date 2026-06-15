with open('Email_PDF_Templates.gs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:429] + lines[469:]

with open('Email_PDF_Templates.gs', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
