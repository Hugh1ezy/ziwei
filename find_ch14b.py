import pdfplumber

pdf_path = 'books/字精成.pdf'
with pdfplumber.open(pdf_path) as pdf:
    # Search pages 530-600 for ch14
    for i in range(529, 600):
        text = (pdf.pages[i].extract_text() or '').replace('戍','戌')
        if '第十四章' in text:
            lines = text.split('\n')
            for j, line in enumerate(lines[:10]):
                if '第十四章' in line:
                    print(f'PDF p{i+1}: {lines[max(0,j-1)]} | {line} | {lines[j+1] if j+1<len(lines) else ""}')
                    break
    print('Scan done')
