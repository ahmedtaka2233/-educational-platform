// ==========================================
// تحسينات متقدمة للبحث عن المواد
// ==========================================

/**
 * تحسين وظيفة البحث عن المادة
 * السماح باختيار المادة مباشرة من نتائج البحث
 */
window.setupAdvancedSubjectSearch = function() {
    const searchInput = document.getElementById('stage-search');
    const searchResults = document.getElementById('search-results');
    
    if (!searchInput || !searchResults) {
        console.warn("Search elements not found");
        return;
    }

    const allSubjects = [
        "اللغة العربية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", 
        "اللغة الإنجليزية", "تكنولوجيا المعلومات والاتصالات", "التربية الدينية", 
        "الحاسب الآلي", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية", 
        "الفيزياء", "الكيمياء", "الأحياء", "التاريخ", "الجغرافيا", 
        "الفلسفة والمنطق", "علم النفس والاجتماع", "الجيولوجيا وعلوم البيئة", 
        "القرآن الكريم", "الفقه", "التفسير", "الحديث", "التوحيد", 
        "النحو", "الصرف", "البلاغة", "الأدب والنصوص", 
        "مبادئ المحاسبة", "تخطيط وإدارة إنتاج"
    ];

    // تنظيف النتائج
    searchResults.innerHTML = '';
    searchResults.style.cssText = `
        position: absolute;
        top: 100%;
        right: 0;
        left: 0;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        list-style: none;
        margin-top: 5px;
        display: none;
    `;

    // معالج حدث الإدخال
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim().toLowerCase();
        searchResults.innerHTML = '';
        
        if (!query || query.length < 1) {
            searchResults.style.display = 'none';
            return;
        }

        try {
            // البحث في قاعدة البيانات
            let matchedSubjects = [];

            // البحث في المواد المعرفة
            const filteredSubjects = allSubjects.filter(subject => 
                subject.toLowerCase().includes(query)
            );

            matchedSubjects = [...filteredSubjects];

            // البحث في database.json إذا كان متاحاً
            try {
                const res = await fetch('database.json');
                if (res.ok) {
                    const dbData = await res.json();
                    for (let key in dbData) {
                        if (key.toLowerCase().includes(query) && !matchedSubjects.includes(key)) {
                            matchedSubjects.push(key);
                        }
                    }
                }
            } catch (dbError) {
                console.debug("Database not available, using default subjects");
            }

            // إزالة التكرارات
            matchedSubjects = [...new Set(matchedSubjects)];

            if (matchedSubjects.length > 0) {
                searchResults.style.display = 'block';
                
                // عرض النتائج (أول 15 نتيجة)
                matchedSubjects.slice(0, 15).forEach((subject, index) => {
                    let li = document.createElement('li');
                    li.style.cssText = `
                        padding: 12px 18px;
                        cursor: pointer;
                        border-bottom: 1px solid #f1f5f9;
                        color: #334155;
                        transition: all 0.2s;
                        font-weight: bold;
                        background: ${index === 0 ? '#f0f9ff' : 'white'};
                    `;
                    
                    // أيقونة البحث
                    li.innerHTML = `<i class="fas fa-search" style="color: #0ea5e9; margin-left: 10px;"></i> ${subject}`;
                    
                    li.onmouseover = () => {
                        li.style.backgroundColor = '#e0f2fe';
                        li.style.color = '#0284c7';
                        li.style.paddingRight = '20px';
                    };
                    
                    li.onmouseout = () => {
                        li.style.backgroundColor = index === 0 ? '#f0f9ff' : 'white';
                        li.style.color = '#334155';
                        li.style.paddingRight = '18px';
                    };
                    
                    li.onclick = (event) => {
                        event.stopPropagation();
                        selectSubjectFromSearch(subject);
                    };
                    
                    searchResults.appendChild(li);
                });

                // إذا كانت هناك نتائج أكثر
                if (matchedSubjects.length > 15) {
                    let moreItem = document.createElement('li');
                    moreItem.style.cssText = `
                        padding: 10px 18px;
                        text-align: center;
                        color: #0ea5e9;
                        font-weight: bold;
                        background: #f1f5f9;
                    `;
                    moreItem.innerHTML = `وأكثر (${matchedSubjects.length - 15})...`;
                    searchResults.appendChild(moreItem);
                }
            } else {
                // لا توجد نتائج
                searchResults.style.display = 'block';
                let noResults = document.createElement('li');
                noResults.style.cssText = `
                    padding: 15px 18px;
                    text-align: center;
                    color: #ef4444;
                    font-weight: bold;
                `;
                noResults.innerHTML = '<i class="fas fa-times-circle"></i> لا توجد نتائج للبحث';
                searchResults.appendChild(noResults);
            }
        } catch (err) {
            console.error("Search error:", err);
            searchResults.style.display = 'none';
        }
    });

    // إغلاق النتائج عند الضغط خارجها
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // دعم الأسهم لاختيار النتائج
    searchInput.addEventListener('keydown', (e) => {
        const items = searchResults.querySelectorAll('li');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[0].focus();
        }
    });
};

/**
 * دالة اختيار المادة من نتائج البحث
 */
function selectSubjectFromSearch(subject) {
    const searchInput = document.getElementById('stage-search');
    const searchResults = document.getElementById('search-results');
    const subjectSelect = document.getElementById('subject-select');
    const yearStage = document.getElementById('year-stage');
    const mainStage = document.getElementById('main-stage');

    // تحديث حقل البحث
    searchInput.value = subject;
    searchResults.style.display = 'none';

    // تخزين المادة المختارة
    window.searchedSubjectTemp = subject;

    // تسليط الضوء على المرحلة الدراسية
    if (mainStage) {
        mainStage.style.borderColor = '#0ea5e9';
        mainStage.style.boxShadow = '0 0 0 4px rgba(14, 165, 233, 0.2)';
        setTimeout(() => {
            mainStage.style.borderColor = '';
            mainStage.style.boxShadow = '';
        }, 2500);
    }

    // عرض رسالة توجيهية
    showToast(`✓ تم اختيار المادة: ${subject}. الآن اختر المرحلة التعليمية والصف الدراسي`, "#10b981");
    
    // محاولة إيجاد المادة في القوائم المنسدلة وتحديدها
    if (subjectSelect) {
        const options = Array.from(subjectSelect.options);
        const matchingOption = options.find(opt => opt.value === subject);
        
        if (matchingOption) {
            subjectSelect.value = subject;
            showToast(`✓ تم تحديد المادة ${subject} بنجاح!`, "#10b981");
            
            // تفعيل زر الرفع إذا تم اختيار جميع المتطلبات
            if (mainStage && mainStage.value !== 'none' && yearStage && yearStage.value) {
                const uploadSection = document.getElementById('student-upload-section');
                if (uploadSection) {
                    uploadSection.classList.remove('hidden-section');
                    uploadSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
    }
}

// تهيئة البحث المتقدم عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // التأكد من أن العناصر موجودة قبل التهيئة
    setTimeout(() => {
        if (document.getElementById('stage-search') && document.getElementById('search-results')) {
            window.setupAdvancedSubjectSearch();
        }
    }, 500);
});
