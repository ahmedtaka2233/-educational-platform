// ==========================================
// مكتبة قوية لطباعة PDF - PDF Helper Functions
// ==========================================

/**
 * دالة قوية لطباعة PDF مع محتوى كامل وتصميم احترافي
 * @param {Object} serverData - بيانات الأسئلة والملخصات
 * @param {String} subjectName - اسم المادة
 * @param {Boolean} isSummaryMode - هل هو وضع الملخص
 */
window.generateAdvancedPDF = async function(serverData, subjectName, isSummaryMode = false) {
    try {
        if (!serverData || !serverData.qa_data || serverData.qa_data.length === 0) {
            showCustomAlert("عفواً، لا توجد بيانات لطباعتها", "error");
            return false;
        }

        showToast("جاري تجهيز ملف PDF متقدم...", "#0ea5e9");

        // إنشاء عنصر مؤقت للطباعة
        const pdfContainer = document.createElement('div');
        pdfContainer.id = 'advanced-pdf-container';
        pdfContainer.style.cssText = `
            position: absolute;
            left: -9999px;
            top: 0;
            width: 800px;
            background: white;
            color: black;
            font-family: 'Cairo', Arial, sans-serif;
            direction: rtl;
            padding: 40px;
        `;

        let htmlContent = buildCompletePDFHTML(serverData, subjectName, isSummaryMode);
        pdfContainer.innerHTML = htmlContent;
        document.body.appendChild(pdfContainer);

        // الانتظار لتحميل الخطوط
        await document.fonts.ready;
        await new Promise(resolve => setTimeout(resolve, 1000));

        const opt = {
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `مذكرة_${subjectName || 'المنصة'}_${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: {
                scale: 3,
                useCORS: true,
                logging: false,
                letterRendering: true,
                scrollY: 0,
                windowWidth: 800,
                backgroundColor: '#ffffff'
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true
            },
            pagebreak: {
                mode: ['avoid-all', 'css', 'legacy'],
                avoid: ['h1', 'h2', 'h3', '.pdf-section-header', '.pdf-question-block']
            }
        };

        await html2pdf().set(opt).from(pdfContainer).save();
        
        pdfContainer.remove();
        showToast("تم إنشاء ملف PDF بنجاح! ✓", "#10b981");
        return true;

    } catch (error) {
        console.error("PDF Generation Error:", error);
        showCustomAlert(`خطأ في إنشاء PDF: ${error.message}`, "error");
        return false;
    }
};

/**
 * بناء محتوى HTML كامل للـ PDF
 */
function buildCompletePDFHTML(serverData, subjectName, isSummaryMode) {
    const dateNow = new Date().toLocaleDateString('ar-EG');
    const timeNow = new Date().toLocaleTimeString('ar-EG');
    const questionCount = serverData.qa_data ? serverData.qa_data.length : 0;

    let html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Cairo', Arial, sans-serif;
                    color: #1e293b;
                    line-height: 1.8;
                    background: white;
                }

                .pdf-header {
                    text-align: center;
                    border-bottom: 3px solid #0ea5e9;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                    page-break-after: avoid;
                }

                .pdf-header h1 {
                    color: #0f172a;
                    font-size: 28px;
                    margin-bottom: 10px;
                    font-weight: 900;
                }

                .pdf-header-subtitle {
                    color: #64748b;
                    font-size: 14px;
                    margin: 5px 0;
                }

                .pdf-meta-info {
                    display: flex;
                    justify-content: space-between;
                    background: #f1f5f9;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    page-break-after: avoid;
                    font-size: 12px;
                }

                .pdf-meta-item {
                    text-align: center;
                    flex: 1;
                    border-left: 1px solid #cbd5e1;
                    padding: 0 15px;
                }

                .pdf-meta-item:last-child {
                    border-left: none;
                }

                .pdf-meta-label {
                    color: #64748b;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .pdf-meta-value {
                    color: #0ea5e9;
                    font-size: 13px;
                    font-weight: bold;
                }

                .pdf-section-header {
                    background: linear-gradient(135deg, #0ea5e9, #3b82f6);
                    color: white;
                    padding: 12px 15px;
                    border-radius: 6px;
                    margin-top: 25px;
                    margin-bottom: 15px;
                    font-size: 16px;
                    font-weight: bold;
                    page-break-after: avoid;
                }

                .pdf-question-block {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-right: 4px solid #0ea5e9;
                    padding: 16px;
                    margin-bottom: 16px;
                    border-radius: 6px;
                    page-break-inside: avoid;
                }

                .pdf-question-number {
                    color: #0ea5e9;
                    font-weight: bold;
                    font-size: 14px;
                    margin-bottom: 8px;
                }

                .pdf-question-text {
                    color: #0f172a;
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    line-height: 1.6;
                }

                .pdf-options {
                    background: white;
                    padding: 12px;
                    border-radius: 4px;
                    margin: 10px 0;
                    border: 1px solid #cbd5e1;
                }

                .pdf-option {
                    padding: 8px 0;
                    border-bottom: 1px solid #f1f5f9;
                    color: #334155;
                    font-size: 13px;
                    line-height: 1.5;
                }

                .pdf-option:last-child {
                    border-bottom: none;
                }

                .pdf-option.correct {
                    color: #059669;
                    font-weight: bold;
                }

                .pdf-answer-section {
                    background: #ecfdf5;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 10px;
                    border-right: 3px solid #059669;
                }

                .pdf-answer-label {
                    color: #059669;
                    font-weight: bold;
                    font-size: 12px;
                    margin-bottom: 5px;
                }

                .pdf-answer-text {
                    color: #065f46;
                    font-size: 13px;
                    line-height: 1.6;
                }

                .pdf-reason-section {
                    background: #fef3c7;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 10px;
                    border-right: 3px solid #b45309;
                }

                .pdf-reason-label {
                    color: #b45309;
                    font-weight: bold;
                    font-size: 12px;
                    margin-bottom: 5px;
                }

                .pdf-reason-text {
                    color: #78350f;
                    font-size: 12px;
                    line-height: 1.6;
                }

                .pdf-summary-content {
                    background: #f0f9ff;
                    padding: 15px;
                    border-radius: 6px;
                    border-right: 4px solid #0284c7;
                    margin-bottom: 16px;
                    page-break-inside: avoid;
                }

                .pdf-summary-title {
                    color: #0284c7;
                    font-weight: bold;
                    font-size: 14px;
                    margin-bottom: 8px;
                }

                .pdf-summary-text {
                    color: #0c4a6e;
                    font-size: 13px;
                    line-height: 1.7;
                }

                .pdf-footer {
                    text-align: center;
                    border-top: 2px solid #cbd5e1;
                    padding-top: 15px;
                    margin-top: 30px;
                    font-size: 11px;
                    color: #64748b;
                    page-break-before: avoid;
                }

                .pdf-watermark {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 80px;
                    color: rgba(14, 165, 233, 0.08);
                    font-weight: bold;
                    z-index: -1;
                    white-space: nowrap;
                }

                .page-break {
                    page-break-after: always;
                }

                @page {
                    size: A4;
                    margin: 20mm;
                }

                @media print {
                    body { margin: 0; padding: 0; }
                    .pdf-watermark { display: block; }
                }
            </style>
        </head>
        <body>
            <div class="pdf-watermark">منصة الذكاء الاصطناعي التعليمية</div>
            
            <div class="pdf-header">
                <h1>منصة الذكاء الاصطناعي التعليمية</h1>
                <div class="pdf-header-subtitle">${isSummaryMode ? '📝 مذكرة ملخص شاملة' : '📋 بنك أسئلة وتمارين'}</div>
                <div class="pdf-header-subtitle">المادة: <strong>${escapeHtml(subjectName)}</strong></div>
            </div>

            <div class="pdf-meta-info">
                <div class="pdf-meta-item">
                    <div class="pdf-meta-label">التاريخ</div>
                    <div class="pdf-meta-value">${dateNow}</div>
                </div>
                <div class="pdf-meta-item">
                    <div class="pdf-meta-label">الوقت</div>
                    <div class="pdf-meta-value">${timeNow}</div>
                </div>
                <div class="pdf-meta-item">
                    <div class="pdf-meta-label">${isSummaryMode ? 'عدد الأقسام' : 'عدد الأسئلة'}</div>
                    <div class="pdf-meta-value">${questionCount}</div>
                </div>
            </div>

            <div class="pdf-section-header">
                ${isSummaryMode ? '📚 الملخص الشامل' : '❓ الأسئلة والتمارين'}
            </div>
    `;

    // إضافة المحتوى
    if (serverData.qa_data && serverData.qa_data.length > 0) {
        serverData.qa_data.forEach((item, index) => {
            if (isSummaryMode) {
                html += buildSummaryItem(item, index + 1);
            } else {
                html += buildQuestionItem(item, index + 1);
            }

            // إضافة فاصل صفحة كل 5 أسئلة
            if ((index + 1) % 5 === 0 && index < serverData.qa_data.length - 1) {
                html += '<div class="page-break"></div>';
                html += '<div class="pdf-section-header">تابع...</div>';
            }
        });
    }

    html += `
            <div class="pdf-footer">
                <div>🔒 تم إنشاء هذا الملف بواسطة منصة الذكاء الاصطناعي التعليمية</div>
                <div>جميع الحقوق محفوظة © 2026</div>
                <div style="margin-top: 10px; border-top: 1px solid #cbd5e1; padding-top: 10px;">
                    📧 للاستفسارات والدعم: support@eduplatform.com
                </div>
            </div>
        </body>
        </html>
    `;

    return html;
}

/**
 * بناء عنصر سؤال في الـ PDF
 */
function buildQuestionItem(item, number) {
    let html = `
        <div class="pdf-question-block">
            <div class="pdf-question-number">السؤال ${number}</div>
            <div class="pdf-question-text">${escapeHtml(stripParentheses(item.q))}</div>
    `;

    // الخيارات
    if (item.options && Array.isArray(item.options) && item.options.length > 0) {
        html += '<div class="pdf-options">';
        item.options.forEach((opt) => {
            let cleanOpt = stripParentheses(opt);
            let isCorrect = item.a && (item.a.includes(cleanOpt) || cleanOpt.includes(item.a));
            html += `
                <div class="pdf-option ${isCorrect ? 'correct' : ''}">
                    ${isCorrect ? '✓ ' : '• '}${escapeHtml(cleanOpt)}
                </div>
            `;
        });
        html += '</div>';
    }

    // الإجابة
    if (item.a) {
        html += `
            <div class="pdf-answer-section">
                <div class="pdf-answer-label">✓ الإجابة الصحيحة:</div>
                <div class="pdf-answer-text">${escapeHtml(item.a).replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }

    // التفسير
    if (item.reason) {
        html += `
            <div class="pdf-reason-section">
                <div class="pdf-reason-label">💡 السبب والتفسير العلمي:</div>
                <div class="pdf-reason-text">${escapeHtml(item.reason).replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

/**
 * بناء عنصر ملخص في الـ PDF
 */
function buildSummaryItem(item, number) {
    let html = `
        <div class="pdf-summary-content">
            <div class="pdf-summary-title">📌 القسم ${number}: ${escapeHtml(stripParentheses(item.q))}</div>
            <div class="pdf-summary-text">${escapeHtml(item.a || '').replace(/\n/g, '<br>')}</div>
    `;

    if (item.reason) {
        html += `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
                <strong>النقاط الرئيسية:</strong><br>
                ${escapeHtml(item.reason).replace(/\n/g, '<br>')}
            </div>
        `;
    }

    html += '</div>';
    return html;
}

/**
 * دالة تنظيف النصوص من الأحرف الخاصة
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * دالة تصدير بيانات الامتحان كـ CSV
 */
window.exportExamToCSV = function(serverData, subjectName) {
    try {
        if (!serverData || !serverData.qa_data) {
            showCustomAlert("لا توجد بيانات للتصدير", "error");
            return;
        }

        let csv = 'رقم السؤال,السؤال,نوع السؤال,الخيارات,الإجابة الصحيحة,التفسير\n';

        serverData.qa_data.forEach((item, index) => {
            const qNum = index + 1;
            const question = (item.q || '').replace(/,/g, '،').replace(/"/g, '""');
            const type = item.type || 'عام';
            const options = (item.options ? item.options.join(' | ') : '').replace(/,/g, '،').replace(/"/g, '""');
            const answer = (item.a || '').replace(/,/g, '،').replace(/"/g, '""');
            const reason = (item.reason || '').replace(/,/g, '،').replace(/"/g, '""');

            csv += `${qNum},"${question}","${type}","${options}","${answer}","${reason}"\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${subjectName || 'المادة'}_${Date.now()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast("تم تصدير البيانات بصيغة CSV بنجاح!", "#10b981");
    } catch (error) {
        showCustomAlert(`خطأ في التصدير: ${error.message}`, "error");
    }
};

/**
 * طباعة مباشرة من المتصفح
 */
window.directPrint = async function(serverData, subjectName, isSummaryMode) {
    try {
        const pdfContainer = document.createElement('div');
        pdfContainer.innerHTML = buildCompletePDFHTML(serverData, subjectName, isSummaryMode);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(pdfContainer.innerHTML);
        printWindow.document.close();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        printWindow.print();
        
        showToast("فتح نافذة الطباعة!", "#0ea5e9");
    } catch (error) {
        showCustomAlert(`خطأ في الطباعة: ${error.message}`, "error");
    }
};
