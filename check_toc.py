import pdfplumber
pdf_path = 'books/字精成.pdf'
with pdfplumber.open(pdf_path) as pdf:
    print('Total pages:', len(pdf.pages))
    for i in range(min(20, len(pdf.pages))):
        text = pdf.pages[i].extract_text() or ''
        if text.strip():
            print('--- PAGE', i+1, '---')
            print(text[:400])
            print()
