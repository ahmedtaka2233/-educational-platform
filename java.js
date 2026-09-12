// @ts-nocheck
// ============================================================================
// ملف الجافاسكريبت الرئيسي (java.js) - منصة الذكاء الاصطناعي (الجزء الأول)
// النسخة الأصلية المكتملة + حلول Autofill
// ============================================================================

const premiumCompactStyle = document.createElement('style');
premiumCompactStyle.innerHTML = `
    body { padding: 10px !important; }
    .container { max-width: 720px !important; padding: 22px !important; border-radius: 16px !important; }
    .action-btn, .download-pdf-btn, .subscribe-btn { padding: 12px !important; font-size: 0.95rem !important; border-radius: 8px !important; }
    .form-group label { font-size: 0.9rem !important; margin-bottom: 6px !important; }
    select, input[type="text"], input[type="password"], input[type="tel"] { padding: 10px 14px !important; font-size: 0.9rem !important; border-radius: 8px !important; }
    .logo-text-box h1 { font-size: 1.5rem !important; }
    .logo-icon-box { width: 45px !important; height: 45px !important; font-size: 1.4rem !important; }
    .interactive-q-card { padding: 15px !important; border-radius: 10px !important; margin-bottom: 15px !important; }
    .interactive-q-title { font-size: 1.05rem !important; margin-bottom: 10px !important; }
    .option-label { padding: 10px 12px !important; font-size: 0.9rem !important; gap: 8px !important; }
    textarea.student-text-answer { font-size: 0.9rem !important; padding: 10px !important; }
    .pdf-question-block { padding: 12px !important; font-size: 0.95rem !important; margin-bottom: 15px !important; }
    #lesson-upload-box { padding: 15px !important; }
    #lesson-upload-box i { font-size: 2rem !important; margin-bottom: 10px !important; }
`;
document.head.appendChild(premiumCompactStyle);

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

function resetSessionTimer() {
    if (isVIPLoggedIn) {
        localStorage.setItem('last_activity_time', Date.now().toString());
    }
}

function checkSessionTimeout() {
    if (isVIPLoggedIn) {
        const lastActivity = localStorage.getItem('last_activity_time');
        if (lastActivity && (Date.now() - parseInt(lastActivity) > SESSION_TIMEOUT_MS)) {
            logout();
            showCustomAlert("تم إنهاء الجلسة التلقائي لحماية حسابك بسبب عدم التفاعل لمدة 5 دقائق. يرجى تسجيل الدخول مجدداً.", 'error');
        }
    }
}

['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, resetSessionTimer);
});

setInterval(checkSessionTimeout, 60000);

window.addEventListener('load', () => {
    setTimeout(() => {
        const customSplash = document.getElementById('custom-splash-screen');
        if (customSplash) {
            customSplash.style.opacity = '0';
            customSplash.style.visibility = 'hidden';
            setTimeout(() => {
                customSplash.remove();
            }, 800);
        }
    }, 3000); 
});

let appHiddenTime = 0;
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        appHiddenTime = Date.now();
    } else if (document.visibilityState === "visible") {
        if (appHiddenTime > 0 && (Date.now() - appHiddenTime > 45000)) {
            window.location.reload();
        }
    }
});

const localDBHelper = {
    openDB: () => new Promise((resolve, reject) => {
        const request = indexedDB.open('EduPlatformOfflineDB', 1);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('offline_analytics')) {
                database.createObjectStore('offline_analytics', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }),
    saveAnalyticsLocally: async (data) => {
        try {
            const database = await localDBHelper.openDB();
            return new Promise((resolve, reject) => {
                const tx = database.transaction('offline_analytics', 'readwrite');
                tx.objectStore('offline_analytics').add({ payload: data, timestamp: Date.now() });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject();
            });
        } catch(e) { 
            console.error("IndexedDB Save Error:", e); 
        }
    },
    clearAnalyticsLocally: async (id) => {
        try {
            const database = await localDBHelper.openDB();
            return new Promise((resolve) => {
                const tx = database.transaction('offline_analytics', 'readwrite');
                tx.objectStore('offline_analytics').delete(id);
                tx.oncomplete = () => resolve();
            });
        } catch(e) {}
    }
};

window.syncOfflineAnalyticsToFirebase = async function(offlineDataList) {
    if(!offlineDataList || offlineDataList.length === 0) return;
    try {
        for(let record of offlineDataList) {
            await db.collection("exam_analytics").add(record.payload);
            await localDBHelper.clearAnalyticsLocally(record.id);
        }
        showToast("تمت مزامنة بيانات الامتحانات الأوفلاين مع السيرفر بنجاح!", "#10b981");
    } catch (e) {
        console.error("فشل المزامنة مع السيرفر:", e);
    }
};

const firebaseConfig = {
    apiKey: "AIzaSyCQ0JfHCIm6QHM8jUstac90kIdViw-djBk",
    authDomain: "educational-platform-19a75.firebaseapp.com",
    projectId: "educational-platform-19a75",
    storageBucket: "educational-platform-19a75.firebasestorage.app",
    messagingSenderId: "929411249577",
    appId: "1:929411249577:web:e5783818589e4ffd8440b8",
    measurementId: "G-JE5DFXY8F1"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const AUTHORIZED_ADMIN_PHONES = ["01026336159"];
const MULTI_DEVICE_PHONES = ["01026336159", "01010482432", "01011974537", "01021059077", "01022750575"];
const VIP_ADMIN_NUMBERS = ["01021059077", "01026336159", "01063028258", "01558884868", "01010482432", "01011974537", "01022750575"];

let currentTeacherId = null;
let isVIPLoggedIn = false; 
let currentUserRole = "User";
let selectedLessonFiles = []; 
let filterSelectedSubject = "";
let filterSelectedStage = "";
let filterSelectedType = "";
let filterSelectedGrade = "";
let globalLessonContext = "لا يوجد درس مرفوع حالياً. أنا مستعد للإجابة على أي أسئلة تعليمية عامة.";
let globalTeacherStyle = "";
let isTeacherRecording = false;
let currentActiveDashTab = "users";

let interactiveExamData = [];
let interactiveExamTimer = null;
let interactiveExamTimeLeft = 0;
let interactiveExamTotalTime = 0;
let examStartTime = 0;

function updateGamification(pointsToAdd) {
    let pts = parseInt(localStorage.getItem('user_points') || '0') + pointsToAdd;
    localStorage.setItem('user_points', pts);
    
    let lastVisit = localStorage.getItem('last_visit_date');
    let today = new Date().toDateString();
    let streak = parseInt(localStorage.getItem('study_streak') || '0');
    
    if (lastVisit !== today) {
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastVisit === yesterday.toDateString()) {
            streak++;
        } else if (!lastVisit) {
            streak = 1;
        } else {
            streak = 1; 
        }
        localStorage.setItem('last_visit_date', today);
        localStorage.setItem('study_streak', streak);
    }
    
    let ptsEl = document.getElementById('ui-user-points');
    let strkEl = document.getElementById('ui-user-streak');
    if(ptsEl) {
        ptsEl.innerText = pts;
    }
    if(strkEl) {
        strkEl.innerText = streak + ' أيام';
    }
}

function showCustomAlert(message, type = 'error') {
    if (document.getElementById('custom-alert-overlay')) {
        document.getElementById('custom-alert-overlay').remove();
    }

    let icon = type === 'error' ? '<i class="fas fa-exclamation-triangle" style="color:#ef4444; font-size: 2.5rem; margin-bottom: 10px;"></i>' : '<i class="fas fa-check-circle" style="color:#10b981; font-size: 2.5rem; margin-bottom: 10px;"></i>';
    let titleColor = type === 'error' ? '#ef4444' : '#10b981';
    let btnColor = type === 'error' ? '#ef4444' : '#10b981';

    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:99999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(5px); padding:15px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:350px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; padding:20px 15px; border-top: 4px solid ${titleColor}; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            ${icon}
            <h3 style="margin: 0 0 10px 0; color:#0f172a; font-size:1.2rem;">تنبيه النظام</h3>
            <p style="color:#475569; font-size:0.95rem; line-height:1.6; margin-bottom:20px; font-weight:bold;">${message}</p>
            <button onclick="document.getElementById('custom-alert-overlay').remove()" style="background:${btnColor}; color:white; border:none; padding:10px 25px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:0.3s;">حسناً</button>
        </div>
        <style>
            @keyframes scaleInAlert { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        </style>
    `;
    document.body.appendChild(overlay);
}

function showCustomConfirm(message, callback) {
    if (document.getElementById('custom-confirm-overlay')) {
        document.getElementById('custom-confirm-overlay').remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:99999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(5px); padding:15px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:350px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; padding:20px 15px; border-top: 4px solid #f59e0b; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            <i class="fas fa-question-circle" style="color:#f59e0b; font-size: 2.5rem; margin-bottom: 10px;"></i>
            <h3 style="margin: 0 0 10px 0; color:#0f172a; font-size:1.2rem;">تأكيد الإجراء</h3>
            <p style="color:#475569; font-size:0.95rem; line-height:1.6; margin-bottom:20px; font-weight:bold;">${message}</p>
            <div style="display:flex; gap:10px;">
                <button id="custom-confirm-yes" style="flex:1; background:#f59e0b; color:white; border:none; padding:10px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 12px rgba(245, 158, 11, 0.2);">نعم، متأكد</button>
                <button id="custom-confirm-no" style="flex:1; background:#f1f5f9; color:#475569; border:none; padding:10px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer;">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('custom-confirm-yes').onclick = () => {
        overlay.remove();
        callback(true);
    };
    document.getElementById('custom-confirm-no').onclick = () => {
        overlay.remove();
        callback(false);
    };
}

function stripParentheses(text) {
    if (!text) return "";
    return text.replace(/\s*\([^)]*\)/g, '').trim();
}

function createAuthScreen() {
    if (document.getElementById('auth-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.85); z-index:999999; display:none; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; overflow-y:auto; font-family: "Cairo", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; backdrop-filter: blur(8px); padding: 15px; box-sizing: border-box;';
    
    overlay.innerHTML = `
        <div style="width:100%; max-width:380px; background:#ffffff; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border-top: 4px solid #0ea5e9; margin: auto; max-height: 95vh; overflow-y: auto;">
            <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:20px 15px; text-align:center; color:white; border-radius: 12px 12px 0 0;">
                <img src="1234.jpg" alt="Logo" style="width: 100px; height: auto; border-radius: 14px; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
                <p style="font-size:0.9rem; color:#cbd5e1; margin:0; font-weight:bold;">منصة الذكاء الاصطناعي التعليمية</p>
            </div>
            
            <div id="auth-user-card" style="padding:20px 20px; text-align:center;">
                <h3 style="color:#1e293b; margin-top:0; margin-bottom:8px; font-size:1.15rem;">تسجيل الدخول للمنصة</h3>
                <p style="color:#64748b; font-size:0.85rem; margin-bottom:15px;" id="auth-instruction-text">أدخل رقم هاتفك للبدء</p>
                
                <input type="tel" id="auth-phone" autocomplete="off" placeholder="رقم الموبايل (مثال: 010xxxxxxxx)" style="width:100%; padding:12px; font-size:1rem; border:2px solid #e2e8f0; border-radius:8px; margin-bottom:10px; box-sizing:border-box; direction:rtl; text-align:center; font-weight:bold;">
                
                <div id="auth-password-container" style="display:none;">
                    <input type="password" id="auth-password" autocomplete="new-password" placeholder="أدخل الرقم السري" style="width:100%; padding:12px; font-size:1rem; border:2px solid #e2e8f0; border-radius:8px; margin-bottom:15px; box-sizing:border-box; direction:rtl; text-align:center; font-weight:bold;">
                </div>
                
                <button id="auth-next-btn" style="width:100%; background:#0ea5e9; color:white; border:none; padding:12px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.3s; box-shadow:0 4px 12px rgba(14,165,233,0.3);">التالي <i class="fas fa-arrow-left"></i></button>
                <button id="auth-login-btn" style="display:none; width:100%; background:#10b981; color:white; border:none; padding:12px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.3s; box-shadow:0 4px 12px rgba(16,185,129,0.3);"><i class="fas fa-sign-in-alt"></i> دخول المنصة</button>
                
                <div style="border-bottom:1px solid #e2e8f0; margin:15px 0;"></div>
                <button id="auth-close-btn" style="width:100%; background:#f1f5f9; color:#475569; border:none; padding:10px; font-size:0.85rem; border-radius:8px; font-weight:bold; cursor:pointer;">إغلاق النافذة</button>
            </div>

            <div id="auth-payment-card" style="padding:20px 20px; text-align:center; display:none;">
                <div style="width:45px; height:45px; background:#fef3c7; color:#b45309; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:1.2rem; margin-bottom:10px;"><i class="fas fa-crown"></i></div>
                <h3 style="color:#1e293b; margin-top:0; margin-bottom:8px;">تفعيل عضوية VIP</h3>
                <p style="color:#64748b; font-size:0.85rem; margin-bottom:15px;">انتهت محاولاتك المجانية. للاستمرار يرجى الاشتراك.</p>
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:15px; font-size:0.85rem; line-height:1.6; color:#334155;">
                    قم بالتحويل لفودافون كاش على الرقم <strong style="color:#0ea5e9; font-size:1rem;" dir="ltr">01026336159</strong><br>
                    وبعد إتمام التحويل، اضغط تأكيد وسنقوم بتوجيهك للواتس آب.
                </div>
                
                <button id="auth-request-btn" style="width:100%; background:#10b981; color:white; border:none; padding:12px; font-size:1rem; border-radius:8px; font-weight:bold; cursor:pointer; margin-bottom:10px; box-shadow:0 4px 12px rgba(16,185,129,0.3);"><i class="fas fa-paper-plane"></i> تأكيد الدفع</button>
                <button id="auth-back-btn" style="width:100%; background:#f1f5f9; color:#475569; border:none; padding:10px; font-size:0.9rem; border-radius:8px; font-weight:bold; cursor:pointer;">رجوع</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('auth-close-btn').addEventListener('click', () => {
        overlay.style.display = 'none';
    });
    
    document.getElementById('auth-back-btn').addEventListener('click', () => {
        document.getElementById('auth-payment-card').style.display = 'none';
        document.getElementById('auth-user-card').style.display = 'block';
    });

    document.getElementById('auth-next-btn').addEventListener('click', handleAuthNextStep);
    document.getElementById('auth-login-btn').addEventListener('click', handleUserLoginFinal);
    document.getElementById('auth-request-btn').addEventListener('click', handlePaymentRequest);
}

function showAuthScreen() {
    createAuthScreen();
    document.getElementById('auth-phone').value = '';
    document.getElementById('auth-phone').disabled = false;
    document.getElementById('auth-password').value = '';
    
    document.getElementById('auth-password-container').style.display = 'none';
    document.getElementById('auth-next-btn').style.display = 'block';
    document.getElementById('auth-login-btn').style.display = 'none';
    
    document.getElementById('auth-user-card').style.display = 'block';
    document.getElementById('auth-payment-card').style.display = 'none';
    document.getElementById('auth-overlay').style.display = 'flex';
}

async function handleAuthNextStep() {
    let phone = document.getElementById('auth-phone').value.trim();
    if (phone.length < 10) {
        return showCustomAlert("برجاء إدخال رقم موبايل صحيح.", 'error');
    }

    let btn = document.getElementById('auth-next-btn');
    let originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
    btn.disabled = true;

    try {
        let isSpecialNumber = VIP_ADMIN_NUMBERS.includes(phone) || AUTHORIZED_ADMIN_PHONES.includes(phone);
        let docSnap = await db.collection("teachers").doc(phone).get();

        if (docSnap.exists) {
            let data = docSnap.data();
            if (data.status === "Free" && !isSpecialNumber) {
                loginSuccess(phone, "User");
            } else {
                document.getElementById('auth-password-container').style.display = 'block';
                document.getElementById('auth-next-btn').style.display = 'none';
                document.getElementById('auth-login-btn').style.display = 'block';
                document.getElementById('auth-phone').disabled = true;
                
                if (!data.studentPassword && !data.adminPassword) {
                    document.getElementById('auth-password').placeholder = "أنشئ رقماً سرياً جديداً لحسابك";
                    document.getElementById('auth-instruction-text').innerText = "يرجى إنشاء رقم سري لحماية حسابك";
                } else {
                    document.getElementById('auth-instruction-text').innerText = "أدخل الرقم السري للمتابعة";
                }
            }
        } else {
            if (isSpecialNumber) {
                document.getElementById('auth-password-container').style.display = 'block';
                document.getElementById('auth-next-btn').style.display = 'none';
                document.getElementById('auth-login-btn').style.display = 'block';
                document.getElementById('auth-phone').disabled = true;
                document.getElementById('auth-password').placeholder = "أنشئ رقماً سرياً لحسابك المميز";
                document.getElementById('auth-instruction-text').innerText = "قم بتعيين رقم سري جديد";
            } else {
                let deviceFingerprint = localStorage.getItem("device_fingerprint") || ("DEV_" + Math.random().toString(36).substring(2, 15));
                await db.collection("teachers").doc(phone).set({
                    name: "Student_" + phone,
                    phone: phone,
                    status: "Free",
                    role: "User",
                    registeredDeviceFingerprint: deviceFingerprint,
                    createdAt: new Date()
                });
                loginSuccess(phone, "User");
                setTimeout(() => {
                    checkFreeTrialAndAccess();
                }, 800);
            }
        }
    } catch (e) {
        showCustomAlert("خطأ في الاتصال بالشبكة.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleUserLoginFinal() {
    const phone = document.getElementById('auth-phone').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (password.length < 4) {
        return showCustomAlert("الرقم السري يجب ألا يقل عن 4 خانات.", 'error');
    }
    
    const btn = document.getElementById('auth-login-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> دخول...';
    
    currentTeacherId = phone;
    let deviceFingerprint = localStorage.getItem("device_fingerprint") || ("DEV_" + Math.random().toString(36).substring(2, 15));
    localStorage.setItem("device_fingerprint", deviceFingerprint);

    try {
        const teacherRef = db.collection("teachers").doc(currentTeacherId);
        const doc = await teacherRef.get();
        let teacherData = doc.data() || {};

        let isAuthorizedAdmin = AUTHORIZED_ADMIN_PHONES.includes(phone);
        let assignedRole = isAuthorizedAdmin ? "Admin" : teacherData.role || "User";

        if (isAuthorizedAdmin) {
            if (!teacherData.adminPassword) {
                await teacherRef.update({ adminPassword: password, status: "VIP_Active", role: "Admin" });
            } else if (teacherData.adminPassword !== password) {
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                return showCustomAlert("الرقم السري للإدارة غير صحيح!", 'error');
            }
        } else {
            if (!teacherData.studentPassword) {
                await teacherRef.update({ studentPassword: password });
            } else if (teacherData.studentPassword !== password) {
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                return showCustomAlert("الرقم السري غير صحيح!", 'error');
            }

            let isExemptFromDeviceLock = MULTI_DEVICE_PHONES.includes(phone);
            if (teacherData.registeredDeviceFingerprint && teacherData.registeredDeviceFingerprint !== deviceFingerprint && !isExemptFromDeviceLock) {
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                return showCustomAlert("هذا الحساب مرتبط بجهاز آخر لحمايتك.", 'error');
            }
            await teacherRef.update({ registeredDeviceFingerprint: deviceFingerprint });
        }

        if (teacherData.status === "Pending_Review") {
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
            document.getElementById('auth-user-card').style.display = 'none';
            document.getElementById('auth-payment-card').style.display = 'block';
            return showCustomAlert("حسابك قيد المراجعة.", 'error');
        }

        let isExpired = await checkAndLockIfExpired(phone, teacherData);
        if (isExpired && !isAuthorizedAdmin) {
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
            document.getElementById('auth-user-card').style.display = 'none';
            document.getElementById('auth-payment-card').style.display = 'block';
            return showCustomAlert("انتهت مدة اشتراكك.", 'error');
        }

        loginSuccess(phone, assignedRole);
        
    } catch (e) {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
        showCustomAlert("خطأ تقني.", 'error');
    }
}

function showAdminQuickActionToast(phone) {
    let toastId = 'quick-action-' + phone;
    if (document.getElementById(toastId)) return;

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.style.cssText = `position:fixed; bottom:20px; right:20px; background:#ffffff; border-right:5px solid #f59e0b; padding:16px 20px; border-radius:10px; font-weight:bold; z-index:9999999; box-shadow:0 10px 25px rgba(0,0,0,0.2); text-align:right; font-family: "Cairo", sans-serif; min-width:300px; animation: slideInRight 0.4s ease; display:flex; flex-direction:column; gap:10px;`;
    
    toast.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#b45309; font-size:1.1rem;"><i class="fas fa-bell"></i> طلب تفعيل جديد!</span>
            <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; cursor:pointer; color:#94a3b8;"><i class="fas fa-times"></i></button>
        </div>
        <p style="margin:0; color:#334155; font-size:0.95rem;">الطالب رقم <span dir="ltr" style="color:#0ea5e9;">${phone}</span> قام بتأكيد الدفع وينتظر التفعيل.</p>
        <button onclick="manualActivateVIP('${phone}'); this.parentElement.remove();" style="background:#10b981; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; width:100%;"><i class="fas fa-check"></i> تفعيل VIP فوراً</button>
        <style>@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }</style>
    `;
    document.body.appendChild(toast);
}

function startAdminNotificationListener() {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    
    db.collection("teachers").where("status", "==", "Pending_Review")
      .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
              if (change.type === "added" || change.type === "modified") {
                  let data = change.doc.data();
                  if (data.paymentRequestedAt) {
                      let reqTime = data.paymentRequestedAt.toDate ? data.paymentRequestedAt.toDate().getTime() : data.paymentRequestedAt;
                      if (Date.now() - reqTime < 5 * 60 * 1000) {
                          showAdminQuickActionToast(change.doc.id);
                      }
                  }
              }
          });
      });
}

async function notifyAdminSubscriptionExpired(expiredPhone, durationText) {
    try {
        const adminAlertMsg = `تنبيه من النظام: المشترك رقم (${expiredPhone}) انتهت مدة اشتراكه (${durationText || "المحددة"}) وتم قفل حسابه وإجباره على التجديد.`;
        await db.collection("admin_notifications").add({
            phone: expiredPhone,
            message: adminAlertMsg,
            type: "SUBSCRIPTION_EXPIRED",
            createdAt: new Date(),
            read: false
        });
    } catch (e) {}
}

async function checkAndLockIfExpired(phone, teacherData) {
    if (AUTHORIZED_ADMIN_PHONES.includes(phone) || MULTI_DEVICE_PHONES.includes(phone) || teacherData.role === "Admin") return false; 
    if (teacherData.isLifetimeVIP) return false;

    if (teacherData.status === "VIP_Active" && teacherData.subscriptionEnd) {
        let endDate = teacherData.subscriptionEnd.toDate ? teacherData.subscriptionEnd.toDate().getTime() : new Date(teacherData.subscriptionEnd).getTime();
        
        if (Date.now() > endDate) {
            await db.collection("teachers").doc(phone).update({
                status: "Expired",
                expiredAt: new Date()
            });
            teacherData.status = "Expired";
            
            notifyAdminSubscriptionExpired(phone, teacherData.vipDurationText || "المدة المحددة");
            return true;
        }
    }
    return (teacherData.status === "Expired");
}

function showFreeTrialSelectionModal() {
    const overlay = document.createElement('div');
    overlay.id = 'free-trial-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.9); z-index:99999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(8px); padding:20px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:450px; border-radius:20px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; padding:35px 25px; border-top: 5px solid #8b5cf6; margin: auto; max-height: 95vh; overflow-y: auto;">
            <i class="fas fa-gift" style="color:#8b5cf6; font-size: 3.5rem; margin-bottom: 15px;"></i>
            <h2 style="margin: 0 0 10px 0; color:#0f172a;">هدية ترحيبية للطلاب الجدد!</h2>
            <p style="color:#475569; font-size:1.05rem; line-height:1.6; margin-bottom:25px;">بما أنك زائر جديد، يمكنك اختيار مدة التجربة المجانية لاختبار قوة المنصة. <b>(هذا العرض متاح مرة واحدة فقط ولا يتجدد نهائياً)</b></p>
            
            <div style="display:flex; flex-direction:column; gap:12px;">
                <button onclick="startFreeTrialTimer(1)" style="background:#f1f5f9; color:#334155; border:2px solid #cbd5e1; padding:15px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; transition:0.3s;" onmouseover="this.style.borderColor='#8b5cf6'" onmouseout="this.style.borderColor='#cbd5e1'">تجربة سريعة (دقيقة واحدة)</button>
                <button onclick="startFreeTrialTimer(5)" style="background:#f1f5f9; color:#334155; border:2px solid #cbd5e1; padding:15px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; transition:0.3s;" onmouseover="this.style.borderColor='#8b5cf6'" onmouseout="this.style.borderColor='#cbd5e1'">تجربة متوسطة (5 دقائق)</button>
                <button onclick="startFreeTrialTimer(10)" style="background:#8b5cf6; color:#ffffff; border:none; padding:15px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1.1rem; box-shadow:0 4px 15px rgba(139,92,246,0.3);">تجربة كاملة (10 دقائق)</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    window.startFreeTrialTimer = function(minutes) {
        localStorage.setItem('has_used_free_trial_v2', 'true');
        localStorage.setItem('free_trial_end_time', Date.now() + (minutes * 60 * 1000));
        overlay.remove();
        showToast(`تم تفعيل تجربتك المجانية لمدة ${minutes} دقائق! استمتع بالمنصة.`, "#8b5cf6");
    };
}

function checkFreeTrialAndAccess() {
    if (isVIPLoggedIn && (currentUserRole === 'Admin' || currentUserRole === 'Teacher')) {
        return true;
    }

    let hasUsedTrial = localStorage.getItem('has_used_free_trial_v2');
    let trialEnd = localStorage.getItem('free_trial_end_time');

    if (!hasUsedTrial) {
        showFreeTrialSelectionModal();
        return false;
    }

    if (trialEnd && Date.now() > parseInt(trialEnd)) {
        showCustomAlert("انتهت فترة التجربة المجانية الخاصة بك نهائياً. يجب عليك تفعيل عضويتك أو الدفع لكل مادة للمتابعة.", 'error');
        setTimeout(() => {
            showAuthScreen();
        }, 1500);
        return false;
    }
    return true; 
}

async function handlePaymentRequest() {
    if (!currentTeacherId) return;

    const btn = document.getElementById('auth-request-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الطلب...';
    btn.style.pointerEvents = "none";

    try {
        const teacherRef = db.collection("teachers").doc(currentTeacherId);
        let isAuthorizedAdmin = AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId);

        await teacherRef.update({
            status: isAuthorizedAdmin ? "VIP_Active" : "Pending_Review",
            paymentRequestedAt: new Date(),
            role: isAuthorizedAdmin ? "Admin" : "User"
        });

        showCustomAlert("تم إرسال طلب التفعيل بنجاح! سيتم توجيهك الآن للواتس آب لإرسال رسالة للإدارة.", 'success');
        
        let adminPhoneForWhatsapp = AUTHORIZED_ADMIN_PHONES[0]; 
        let whatsappMsg = encodeURIComponent(`مرحباً.. لقد قمت بتحويل مبلغ الاشتراك للمنصة.\nبرجاء تفعيل حسابي.\nرقم هاتفي المسجل هو: ${currentTeacherId}`);
        setTimeout(() => {
            window.open(`https://wa.me/2${adminPhoneForWhatsapp}?text=${whatsappMsg}`, '_blank');
        }, 1500);
        
        document.getElementById('auth-overlay').style.display = 'none';
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> تأكيد الدفع وطلب التفعيل';
        btn.style.pointerEvents = "auto";
    } catch (err) {
        showCustomAlert("حدث خطأ أثناء إرسال الطلب: " + err.message, 'error');
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> تأكيد الدفع وطلب التفعيل';
        btn.style.pointerEvents = "auto";
    }
}

function showToast(message, bgColor = "#10b981") {
    let toast = document.getElementById('sys-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sys-toast';
        toast.style.cssText = `position:fixed; top:-100px; left:50%; transform:translateX(-50%); background:${bgColor}; color:white; padding:16px 32px; border-radius:10px; font-weight:bold; font-size:1.1rem; z-index:9999999; box-shadow:0 4px 15px rgba(0,0,0,0.2); transition:top 0.4s ease; text-align:center; font-family: "Cairo", "Segoe UI", sans-serif;`;
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    toast.style.background = bgColor;
    setTimeout(() => {
        toast.style.top = '20px';
    }, 100);
    setTimeout(() => {
        toast.style.top = '-100px';
    }, 3500);
}

function loginSuccess(phone, role) {
    isVIPLoggedIn = true;
    currentUserRole = role;
    currentTeacherId = phone;
    
    localStorage.setItem('saved_user_phone', phone);
    localStorage.setItem('saved_user_role', role);
    resetSessionTimer();
    
    // =========================================================
    // كود حارس خانة البحث القوي: يمنع الرقم من الظهور فيها تماماً
    // =========================================================
    let searchBoxElem = document.getElementById('stage-search');
    if (searchBoxElem) {
        searchBoxElem.value = '';
        searchBoxElem.setAttribute('name', 'search-term-' + Date.now()); 
        searchBoxElem.setAttribute('autocomplete', 'new-password'); 
        
        let clearAttempts = 0;
        let clearSearchInterval = setInterval(() => {
            if (searchBoxElem.value === phone || searchBoxElem.value === localStorage.getItem('saved_user_phone')) {
                searchBoxElem.value = '';
            }
            clearAttempts++;
            if (clearAttempts > 10) { 
                clearInterval(clearSearchInterval); 
            }
        }, 300);
    }
    
    updateGamification(0); 

    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
    
    const oldTeacherSec = document.querySelector('.teacher-section');
    if (oldTeacherSec) oldTeacherSec.style.display = 'none';

    showToast("تم تسجيل الدخول بنجاح!");
    buildDynamicUserMenu(phone, role);

    if (role === 'Admin' || AUTHORIZED_ADMIN_PHONES.includes(phone)) {
        startAdminNotificationListener();
    }
}

function logout() {
    isVIPLoggedIn = false;
    currentTeacherId = null;
    currentUserRole = "User";
    
    localStorage.removeItem('saved_user_phone');
    localStorage.removeItem('saved_user_role');
    localStorage.removeItem('last_activity_time');
    
    const oldTeacherSec = document.querySelector('.teacher-section');
    if (oldTeacherSec) oldTeacherSec.style.display = 'block';
    
    const menu = document.getElementById('dynamic-user-menu');
    if (menu) menu.remove();

    showToast("تم تسجيل الخروج", "#ef4444");
    showAuthScreen();
}

async function changeAdminPassword() {
    if (!currentTeacherId || (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin')) {
        showCustomAlert("غير مصرح لك بتغيير كلمة السر.", 'error');
        return;
    }

    if (document.getElementById('custom-change-pass-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'custom-change-pass-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:9999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(6px); padding:20px; overflow-y:auto;';
    
    modal.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:440px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4); border-top: 5px solid #0284c7; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            <div style="padding:22px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:38px; height:38px; background:#e0f2fe; color:#0284c7; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem;"><i class="fas fa-key"></i></div>
                    <h3 style="margin:0; color:#0f172a; font-size:1.15rem; font-weight:bold;">تغيير الرقم السري للإدارة</h3>
                </div>
                <button id="change-pass-close-x" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b;"><i class="fas fa-times"></i></button>
            </div>
            <div style="padding:22px 20px;">
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:0.88rem; color:#334155; margin-bottom:6px; font-weight:bold;">الرقم السري الحالي:</label>
                    <input type="password" id="cp-old" placeholder="أدخل الباسورد الحالي..." style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; box-sizing:border-box;">
                </div>
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:0.88rem; color:#334155; margin-bottom:6px; font-weight:bold;">الرقم السري الجديد:</label>
                    <input type="password" id="cp-new" placeholder="أدخل الرقم الجديد (4 خانات على الأقل)..." style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; box-sizing:border-box;">
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block; font-size:0.88rem; color:#334155; margin-bottom:6px; font-weight:bold;">تأكيد الرقم السري الجديد:</label>
                    <input type="password" id="cp-confirm" placeholder="أعد إدخال الرقم الجديد..." style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:1rem; box-sizing:border-box;">
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="cp-submit-btn" style="flex:1; background:#0284c7; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem;"><i class="fas fa-save"></i> حفظ</button>
                    <button id="cp-cancel-btn" style="background:#f1f5f9; color:#475569; border:none; padding:12px 18px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem;">إلغاء</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('change-pass-close-x').onclick = () => {
        modal.remove();
    };
    document.getElementById('cp-cancel-btn').onclick = () => {
        modal.remove();
    };

    document.getElementById('cp-submit-btn').onclick = async () => {
        const oldPass = document.getElementById('cp-old').value.trim();
        const newPass = document.getElementById('cp-new').value.trim();
        const confirmPass = document.getElementById('cp-confirm').value.trim();

        if (!oldPass || !newPass || !confirmPass) {
            showCustomAlert("برجاء ملء جميع الحقول المطلوبة.", 'error');
            return;
        }

        if (newPass.length < 4) {
            showCustomAlert("يجب ألا يقل الرقم السري الجديد عن 4 أرقام أو أحرف.", 'error');
            return;
        }

        if (newPass !== confirmPass) {
            showCustomAlert("كلمتا السر الجديدتان غير متطابقتين.", 'error');
            return;
        }

        try {
            const teacherRef = db.collection("teachers").doc(currentTeacherId);
            const doc = await teacherRef.get();
            
            if (!doc.exists) {
                showCustomAlert("الحساب غير موجود في قاعدة البيانات.", 'error');
                return;
            }

            let teacherData = doc.data();
            let currentSavedPassword = teacherData.adminPassword || "1234";

            if (oldPass !== currentSavedPassword) {
                showCustomAlert("الرقم السري الحالي غير صحيح!", 'error');
                return;
            }

            await teacherRef.update({
                adminPassword: newPass.trim(),
                passwordLastChangedAt: new Date()
            });

            modal.remove();
            showCustomAlert("تم تحديث الرقم السري للإدارة بنجاح!", 'success');

        } catch (e) {
            showCustomAlert("حدث خطأ أثناء تغيير الرقم السري: " + e.message, 'error');
        }
    };
}

function startTeacherRecordingAction() {
    showCustomAlert("أداة تسجيل أسلوب المعلم قيد التطوير حالياً، وسيتم تفعيلها قريباً جداً في التحديث القادم.", 'success');
}

function buildDynamicUserMenu(phone, role) {
    if (document.getElementById('dynamic-user-menu')) return;
    
    const menu = document.createElement('div');
    menu.id = 'dynamic-user-menu';
    menu.style.cssText = 'background:#f8fafc; padding:20px; border-radius:12px; border:2px solid #0ea5e9; margin-top:20px; margin-bottom:20px; text-align:center; box-shadow: 0 4px 10px rgba(0,0,0,0.05); font-family: "Cairo", "Segoe UI", sans-serif;';
    
    let pts = parseInt(localStorage.getItem('user_points') || '0');
    let streak = parseInt(localStorage.getItem('study_streak') || '0');

    let html = `
        <h3 style="color:#0f172a; margin-top:0;"><i class="fas fa-user-check"></i> الحساب مفعل (VIP)</h3>
        <p style="color:#64748b; font-weight:bold; margin-bottom:15px;">رقم الحساب: <span dir="ltr">${phone}</span></p>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; background:#ffffff; padding:15px; border-radius:12px; border:1px solid #e2e8f0; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
            <div style="text-align:center; flex:1; border-left:1px solid #e2e8f0;">
                <i class="fas fa-fire" style="color:#f59e0b; font-size:1.8rem; margin-bottom:5px;"></i>
                <div style="font-size:0.85rem; color:#64748b; font-weight:bold;">سلسلة المذاكرة</div>
                <div id="ui-user-streak" style="font-weight:900; color:#0f172a; font-size:1.1rem;">${streak} أيام</div>
            </div>
            <div style="text-align:center; flex:1;">
                <i class="fas fa-coins" style="color:#10b981; font-size:1.8rem; margin-bottom:5px;"></i>
                <div style="font-size:0.85rem; color:#64748b; font-weight:bold;">نقاطي الذهبية</div>
                <div id="ui-user-points" style="font-weight:900; color:#0f172a; font-size:1.1rem;">${pts}</div>
            </div>
        </div>
    `;
    
    html += `<button id="btn-dyn-record" class="btn action-btn" style="background:#8b5cf6; margin-bottom:10px; width:100%;"><i class="fas fa-microphone-alt"></i> أداة تسجيل أسلوب المعلم</button>`;
    
    if (role === 'Admin' || AUTHORIZED_ADMIN_PHONES.includes(phone)) {
        html += `<button id="btn-dyn-dash" class="btn action-btn" style="background:#0b194f; color:#ffffff; margin-bottom:10px; width:100%;"><i class="fas fa-chart-line"></i> لوحة التحكم والإدارة (Dashboard)</button>`;
        html += `<button id="btn-dyn-change-pass" class="btn action-btn" style="background:#0284c7; color:#ffffff; margin-bottom:10px; width:100%;"><i class="fas fa-key"></i> تغيير الرقم السري للإدارة</button>`;
    }
    
    html += `<button id="btn-dyn-logout" class="btn" style="background:#ef4444; color:white; border:none; padding:14px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; margin-top:10px;"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</button>`;
    
    menu.innerHTML = html;
    
    const processBtn = document.getElementById('process-btn');
    if (processBtn && processBtn.parentNode) {
        processBtn.parentNode.insertBefore(menu, processBtn);
    }

    document.getElementById('btn-dyn-logout').addEventListener('click', logout);
    
    const recordBtn = document.getElementById('btn-dyn-record');
    if (recordBtn) {
        recordBtn.addEventListener('click', startTeacherRecordingAction);
    }
    
    if (role === 'Admin' || AUTHORIZED_ADMIN_PHONES.includes(phone)) {
        const dashBtn = document.getElementById('btn-dyn-dash');
        if (dashBtn) {
            dashBtn.addEventListener('click', loadAndShowDashboard);
        }

        const changePassBtn = document.getElementById('btn-dyn-change-pass');
        if (changePassBtn) {
            changePassBtn.addEventListener('click', changeAdminPassword);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    createAuthScreen();

    const lastAct = localStorage.getItem('last_activity_time');
    if (lastAct && (Date.now() - parseInt(lastAct) > SESSION_TIMEOUT_MS)) {
        localStorage.removeItem('saved_user_phone');
        localStorage.removeItem('saved_user_role');
        localStorage.removeItem('last_activity_time');
    }

    const savedPhone = localStorage.getItem('saved_user_phone');
    const savedRole = localStorage.getItem('saved_user_role') || "User";

    if (savedPhone) {
        currentTeacherId = savedPhone;
        loginSuccess(savedPhone, savedRole);
    } else {
        showAuthScreen();
    }

    const oldTeacherToggle = document.getElementById('teacher-mode');
    if (oldTeacherToggle) {
        oldTeacherToggle.addEventListener('click', (e) => {
            e.preventDefault(); 
            showAuthScreen();
        });
    }

    const subjectsDB = {
        primary_general: ["اللغة العربية", "الرياضيات", "اللغة الإنجليزية", "العلوم", "الدراسات الاجتماعية", "تكنولوجيا المعلومات", "التربية الدينية"],
        primary_azhar: ["القرآن الكريم", "التربية الإسلامية", "اللغة العربية", "الرياضيات", "اللغة الإنجليزية", "العلوم", "الدراسات الاجتماعية"],
        prep_general: ["اللغة العربية", "الرياضيات (جبر وإحصاء)", "الرياضيات (هندسة)", "العلوم", "الدراسات الاجتماعية", "اللغة الإنجليزية", "اللغة الفرنسية"],
        prep_azhar: ["القرآن الكريم", "الفقه", "أصول الدين", "النحو", "الصرف", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "اللغة الإنجليزية"],
        high_general_sci_biology: ["اللغة العربية", "اللغة الإنجليزية", "الفيزياء", "الكيمياء", "الأحياء", "الجيولوجيا", "اللغة الأجنبية الثانية", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية"],
        high_general_sci_math: ["اللغة العربية", "اللغة الإنجليزية", "الفيزياء", "الكيمياء", "الرياضيات البحتة", "الرياضيات التطبيقية", "اللغة الأجنبية الثانية", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية"],
        high_general_lit: ["اللغة العربية", "اللغة الإنجليزية", "التاريخ", "الجغرافيا", "علم النفس", "الفلسفة والمنطق", "اللغة الأجنبية الثانية", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية"],
        high_azhar_sci: ["القرآن الكريم", "الفقه", "الحديث", "النحو", "الصرف", "الفيزياء", "الكيمياء", "الأحياء", "الرياضيات", "اللغة الإنجليزية", "اللغة الفرنسية"],
        high_azhar_lit: ["القرآن الكريم", "الفقه", "الحديث", "النحو", "الصرف", "التاريخ", "الجغرافيا", "المنطق", "اللغة الإنجليزية", "اللغة الفرنسية"],
        diploma_industrial: ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "الفيزياء العامة", "تخصصات صناعية متعددة"],
        diploma_commercial: ["اللغة العربية", "اللغة الإنجليزية", "إدارة أعمال", "محاسبة مالية", "سكرتارية", "اقتصاد وإحصاء"],
        diploma_agricultural: ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "محاصيل الحقل", "أمراض النبات", "صناعات زراعية"],
        diploma_tourism: ["اللغة العربية", "اللغة الإنجليزية", "أصول فن الطهو", "خدمة المطاعم", "شركات السياحة", "محاسبة فندقية", "اللغة الفرنسية"]
    };

    function getOrdinal(i) {
        const ordinals = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];
        return ordinals[i];
    }

    const ui = {
        searchInput: document.getElementById('stage-search'),
        searchResults: document.getElementById('search-results'),
        filterContainer: document.getElementById('search-filter-container'),
        filterTitle: document.getElementById('filter-title'),
        filterStage: document.getElementById('filter-stage-step'),
        filterType: document.getElementById('filter-type-step'),
        filterGrade: document.getElementById('filter-grade-step'),
        mainStage: document.getElementById('main-stage'),
        subStage: document.getElementById('sub-stage'),
        subStageContainer: document.getElementById('sub-stage-container'),
        yearStage: document.getElementById('year-stage'),
        yearStageContainer: document.getElementById('year-stage-container'),
        subjectSelect: document.getElementById('subject-select'),
        subjectContainer: document.getElementById('subject-container'),
        pathDisplay: document.getElementById('selected-path-display'),
        studentUploadSection: document.getElementById('student-upload-section'),
        extractionSettings: document.getElementById('extraction-settings')
    };

    if (ui.searchInput) {
        ui.searchInput.value = '';
        ui.searchInput.setAttribute('autocomplete', 'new-password'); 
        ui.searchInput.setAttribute('readonly', 'readonly');
        setTimeout(() => { ui.searchInput.removeAttribute('readonly'); }, 500);
    }

    function normalizeText(text) { 
        let normalized = text.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
        return normalized.toLowerCase(); 
    }

    if (ui.searchInput) {
        ui.searchInput.addEventListener('input', (event) => {
            const query = normalizeText(event.target.value.trim());
            ui.searchResults.innerHTML = '';
            hideElement(ui.filterContainer);
            
            if (query.length < 2) { 
                ui.searchResults.style.display = 'none'; 
                return; 
            }
            
            let matchedSubjects = [];
            for (const [pathKey, subjects] of Object.entries(subjectsDB)) {
                subjects.forEach((subject) => {
                    if (normalizeText(subject).includes(query) && !matchedSubjects.includes(subject)) {
                        matchedSubjects.push(subject);
                    }
                });
            }

            if (matchedSubjects.length > 0) {
                ui.searchResults.style.display = 'block';
                matchedSubjects.slice(0, 10).forEach((sub) => { 
                    let li = document.createElement('li');
                    li.innerHTML = '<i class="fas fa-book-open"></i> ' + sub;
                    li.onclick = () => {
                        ui.searchInput.value = sub;
                        ui.searchResults.style.display = 'none';
                        filterSelectedSubject = sub;
                        startFilterProcess(sub);
                    };
                    ui.searchResults.appendChild(li);
                });
            } else {
                ui.searchResults.style.display = 'none';
            }
        });
    }

    function createFilterButton(text, onClickFunction) {
        let btn = document.createElement('button');
        btn.style.padding = "10px 18px"; 
        btn.style.border = "1px solid var(--primary-color)";
        btn.style.borderRadius = "8px"; 
        btn.style.background = "white";
        btn.style.color = "var(--primary-dark)"; 
        btn.style.cursor = "pointer";
        btn.style.fontWeight = "bold"; 
        btn.innerHTML = text;
        
        btn.onmouseover = () => { btn.style.background = "var(--primary-light)"; };
        btn.onmouseout = () => { btn.style.background = "white"; };
        btn.onclick = onClickFunction;
        return btn;
    }

    function startFilterProcess(subject) {
        showElement(ui.filterContainer);
        ui.filterStage.innerHTML = ''; ui.filterType.innerHTML = ''; ui.filterGrade.innerHTML = '';
        ui.filterTitle.innerHTML = 'اختر المرحلة الدراسية لمادة: ' + subject;
        
        ui.filterStage.appendChild(createFilterButton('المرحلة الابتدائية', () => selectFilterStage('primary')));
        ui.filterStage.appendChild(createFilterButton('المرحلة الإعدادية', () => selectFilterStage('prep')));
        ui.filterStage.appendChild(createFilterButton('المرحلة الثانوية', () => selectFilterStage('high')));
        ui.filterStage.appendChild(createFilterButton('الدبلومات الفنية', () => selectFilterStage('diploma')));
    }

    function selectFilterStage(stage) {
        filterSelectedStage = stage;
        ui.filterType.innerHTML = ''; ui.filterGrade.innerHTML = '';
        ui.filterTitle.innerHTML = 'اختر نوع التعليم:';
        
        if (stage === 'primary' || stage === 'prep') {
            ui.filterType.appendChild(createFilterButton('تربية وتعليم (عام)', () => selectFilterType('general')));
            ui.filterType.appendChild(createFilterButton('أزهري', () => selectFilterType('azhar')));
        } else if (stage === 'high') {
            ui.filterType.appendChild(createFilterButton('عام - علمي علوم', () => selectFilterType('general_sci_biology')));
            ui.filterType.appendChild(createFilterButton('عام - علمي رياضة', () => selectFilterType('general_sci_math')));
            ui.filterType.appendChild(createFilterButton('عام - أدبي', () => selectFilterType('general_lit')));
            ui.filterType.appendChild(createFilterButton('أزهري - علمي', () => selectFilterType('azhar_sci')));
            ui.filterType.appendChild(createFilterButton('أزهري - أدبي', () => selectFilterType('azhar_lit')));
        } else if (stage === 'diploma') {
            ui.filterType.appendChild(createFilterButton('دبلوم صناعي', () => selectFilterType('industrial')));
            ui.filterType.appendChild(createFilterButton('دبلوم تجاري', () => selectFilterType('commercial')));
            ui.filterType.appendChild(createFilterButton('دبلوم زراعي', () => selectFilterType('agricultural')));
            ui.filterType.appendChild(createFilterButton('دبلوم سياحة', () => selectFilterType('tourism')));
        }
    }

    function finishFiltering(grade) {
        filterSelectedGrade = grade;
        hideElement(ui.filterContainer);
        let finalPath = "";
        
        if (filterSelectedStage === 'primary' || filterSelectedStage === 'prep') {
            finalPath = filterSelectedStage + '_' + filterSelectedType;
        } else if (filterSelectedStage === 'high') {
            finalPath = 'high_' + filterSelectedType;
        } else if (filterSelectedStage === 'diploma') {
            finalPath = 'diploma_' + filterSelectedType;
        }
        
        autoFillDropdowns(finalPath, filterSelectedGrade, filterSelectedSubject);
    }

    function selectFilterType(type) {
        filterSelectedType = type;
        ui.filterGrade.innerHTML = '';
        ui.filterTitle.innerHTML = 'اختر الصف الدراسي:';
        
        let startGrade = 1;
        let endGrade = (filterSelectedStage === 'primary') ? 6 : 3;
        
        for (let i = startGrade; i <= endGrade; i++) {
            ui.filterGrade.appendChild(createFilterButton('الصف ' + getOrdinal(i), () => finishFiltering(i)));
        }
    }

    function updatePathDisplay() {
        if (!ui.pathDisplay) return; 
        try {
            let stage = ui.mainStage.options[ui.mainStage.selectedIndex] ? ui.mainStage.options[ui.mainStage.selectedIndex].text : "";
            let sub = ui.subStage.options[ui.subStage.selectedIndex] ? ui.subStage.options[ui.subStage.selectedIndex].text : "";
            let year = ui.yearStage.options[ui.yearStage.selectedIndex] ? ui.yearStage.options[ui.yearStage.selectedIndex].text : "";
            const subject = ui.subjectSelect.value;
            
            let path = stage;
            if (sub && !sub.includes('--')) path += ` > ${sub}`;
            if (year && !year.includes('--')) path += ` > ${year}`;
            if (subject) path += ` > ${subject}`;
            
            ui.pathDisplay.innerHTML = '<i class="fas fa-map-marker-alt"></i> مسار المادة المحدد: <br> ' + path;
            ui.pathDisplay.style.display = 'block';
        } catch (error) {}
    }

    if (ui.mainStage) {
        ui.mainStage.addEventListener('change', (event) => {
            const val = event.target.value; 
            hideAllChildSections();
            
            if (val === 'primary' || val === 'prep') { 
                ui.subStage.innerHTML = '<option value="">-- حدد نوع التعليم --</option><option value="general">تربية وتعليم (عام)</option><option value="azhar">أزهري</option>';
                showElement(ui.subStageContainer); 
            } else if (val === 'high_general') { 
                ui.subStage.innerHTML = '<option value="">-- حدد الشعبة --</option><option value="sci_biology">علمي علوم</option><option value="sci_math">علمي رياضة</option><option value="lit">أدبي</option>';
                showElement(ui.subStageContainer); 
            } else if (val === 'high_azhar') { 
                ui.subStage.innerHTML = '<option value="">-- حدد الشعبة --</option><option value="sci">علمي</option><option value="lit">أدبي</option>';
                showElement(ui.subStageContainer); 
            } else if (val === 'diploma') { 
                ui.subStage.innerHTML = '<option value="">-- حدد التخصص --</option><option value="industrial">صناعي</option><option value="commercial">تجاري</option><option value="agricultural">زراعي</option><option value="tourism">سياحة وفنادق</option>';
                showElement(ui.subStageContainer); 
            }
        });
    }

    if (ui.subStage) {
        ui.subStage.addEventListener('change', (event) => {
            if (event.target.value) {
                let currentTrackPath = ui.mainStage.value;
                if (!currentTrackPath.includes('high_') && currentTrackPath !== 'diploma') currentTrackPath += '_';
                else if (currentTrackPath === 'diploma') currentTrackPath += '_';
                
                if (ui.mainStage.value.includes('high')) currentTrackPath = ui.mainStage.value + '_' + event.target.value;
                else currentTrackPath += event.target.value;
                
                let limit = (ui.mainStage.value === 'primary') ? 6 : 3;
                populateYears(1, limit, ui.mainStage.value.split('_')[0], currentTrackPath);
                
                showElement(ui.yearStageContainer);
            } else {
                hideAllChildSections(true);
            }
        });
    }

    if (ui.yearStage) {
        ui.yearStage.addEventListener('change', (event) => {
            if (event.target.value) { 
                populateSubjects(ui.yearStage.getAttribute('data-current-path')); 
                showElement(ui.subjectContainer); 
                if (ui.pathDisplay) ui.pathDisplay.style.display = 'none'; 
            } else { 
                hideElement(ui.subjectContainer); 
                hideElement(ui.extractionSettings); 
                hideElement(ui.studentUploadSection); 
                if (ui.pathDisplay) ui.pathDisplay.style.display = 'none'; 
            }
        });
    }

    if (ui.subjectSelect) {
        ui.subjectSelect.addEventListener('change', (event) => {
            if (event.target.value) { 
                showElement(ui.studentUploadSection); 
                showElement(ui.extractionSettings); 
                updatePathDisplay(); 
            } else { 
                hideElement(ui.extractionSettings); 
                hideElement(ui.studentUploadSection); 
                if (ui.pathDisplay) ui.pathDisplay.style.display = 'none'; 
            }
        });
    }

    function populateYears(start, end, stageType, trackPath) {
        let html = '<option value="">-- اختر الصف الدراسي --</option>';
        for (let i = start; i <= end; i++) { 
            html += '<option value="' + i + '">الصف ' + getOrdinal(i);
            if (stageType === 'primary') html += ' الابتدائي';
            else if (stageType === 'prep') html += ' الإعدادي';
            else if (stageType === 'high') html += ' الثانوي';
            else if (stageType === 'diploma') html += ' (دبلوم)';
            html += '</option>';
        }
        ui.yearStage.innerHTML = html; 
        ui.yearStage.setAttribute('data-current-path', trackPath);
        hideElement(ui.subjectContainer); 
        hideElement(ui.studentUploadSection);
    }
    
    function populateSubjects(path) {
        const subjects = subjectsDB[path] || []; 
        let html = '<option value="">-- اختر المادة العلمية --</option>';
        subjects.forEach((sub) => { 
            html += '<option value="' + sub + '">' + sub + '</option>'; 
        });
        ui.subjectSelect.innerHTML = html;
    }
    
    function showElement(el) { 
        if (!el) return; 
        el.classList.remove('hidden-section'); 
        el.classList.add('show-anim'); 
    }
    
    function hideElement(el) { 
        if (!el) return; 
        el.classList.remove('show-anim'); 
        el.classList.add('hidden-section'); 
    }
    
    function hideAllChildSections(keepSub = false) { 
        if (!keepSub) {
            hideElement(ui.subStageContainer); 
        }
        hideElement(ui.yearStageContainer); 
        hideElement(ui.subjectContainer); 
        hideElement(ui.extractionSettings); 
        hideElement(ui.studentUploadSection);
        if (ui.pathDisplay) {
            ui.pathDisplay.style.display = 'none'; 
        }
    }

    function autoFillDropdowns(pathKey, yearIndex, subject) {
        const parts = pathKey.split('_');
        
        if (parts[0] === 'high') {
            ui.mainStage.value = parts[0] + '_' + parts[1];
        } else {
            ui.mainStage.value = parts[0];
        }
        
        ui.mainStage.dispatchEvent(new Event('change'));
        
        if (parts[0] === 'high' && parts.length > 2) {
            ui.subStage.value = parts.slice(2).join('_');
        } else if (parts.length > 1) {
            ui.subStage.value = parts.slice(1).join('_');
        }
        
        ui.subStage.dispatchEvent(new Event('change'));
        
        ui.yearStage.value = yearIndex;
        ui.yearStage.dispatchEvent(new Event('change'));
        ui.subjectSelect.value = subject;
        ui.subjectSelect.dispatchEvent(new Event('change'));
    }

    const lessonUploadBox = document.getElementById('lesson-upload-box');
    const lessonImageInput = document.getElementById('lesson-image');
    
    if (lessonUploadBox) {
        lessonUploadBox.addEventListener('click', () => { 
            lessonImageInput.click(); 
        });
    }

    if (lessonImageInput) {
        lessonImageInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                if (event.target.files.length > 10) {
                    showCustomAlert("عفواً، أقصى عدد مسموح به هو 10 صور فقط في المرة الواحدة! يرجى اختيار 10 صور أو أقل.", 'error');
                    event.target.value = ""; 
                    selectedLessonFiles = [];
                    return;
                }

                for(let i = 0; i < event.target.files.length; i++) {
                    if (!event.target.files[i].type.includes('image')) {
                        showCustomAlert("عفواً، مسموح برفع الصور فقط.", 'error');
                        event.target.value = ""; 
                        return;
                    }
                }
                
                selectedLessonFiles = Array.from(event.target.files);
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewImg = document.getElementById('image-preview');
                    if (previewImg) {
                        previewImg.src = e.target.result;
                        showElement(document.getElementById('image-preview-container'));
                    }
                };
                reader.readAsDataURL(selectedLessonFiles[0]);
                
                document.getElementById('lesson-upload-text').innerHTML = '<i class="fas fa-check-circle"></i> تم إرفاق ' + selectedLessonFiles.length + ' صور بنجاح';
                lessonUploadBox.style.borderColor = "var(--success-color)";
                lessonUploadBox.style.backgroundColor = "#ecfdf5";
            }
        });
    }

    async function generateFileHash(file) {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    const processBtn = document.getElementById('process-btn');
    
    if (processBtn) {
        processBtn.addEventListener('click', async () => {
            
            if (!isVIPLoggedIn) {
                if (!checkAttempts()) return;
            }
            
            const subject = ui.subjectSelect.value;
            let yearText = "";
            if (ui.yearStage.options[ui.yearStage.selectedIndex]) {
                yearText = ui.yearStage.options[ui.yearStage.selectedIndex].text;
            }
            
            if (!subject || !yearText) { 
                showCustomAlert("يرجى إكمال تحديد المرحلة، الصف الدراسي، والمادة العلمية أولاً.", 'error'); 
                return; 
            }
            
            if (selectedLessonFiles.length === 0) { 
                showCustomAlert("يرجى تصوير أو إرفاق صورة أولاً.", 'error'); 
                return; 
            }

            if (selectedLessonFiles.length > 10) {
                showCustomAlert("عفواً، أقصى عدد مسموح به هو 10 صور فقط في المرة الواحدة!", 'error');
                return;
            }

            const btnText = document.getElementById('btn-text');
            processBtn.classList.add('processing');
            btnText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري ضغط الصور ومعالجتها...';
            
            try {
                const newImageHash = await generateFileHash(selectedLessonFiles[0]) + "_" + selectedLessonFiles.length;
                let summaryIdStr = subject + '_' + yearText;
                const summaryDocId = summaryIdStr.replace(/\s+/g, '_');
                const summaryRef = db.collection("summaries").doc(summaryDocId);
                const docSnap = await summaryRef.get();

                let existingData = {};
                if (docSnap.exists) {
                    existingData = docSnap.data();
                }

                btnText.innerHTML = '<i class="fas fa-compress"></i> جاري الإرسال للسيرفر الخلفي...';

                if (existingData.current_version) {
                    existingData.archived_version = { ...existingData.current_version, archived_at: new Date() };
                }

                const imagesBase64List = [];
                for (let file of selectedLessonFiles) {
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = function(event) {
                            const img = new Image();
                            img.onload = function() {
                                const canvas = document.createElement('canvas');
                                const MAX_WIDTH = 1200;
                                const MAX_HEIGHT = 1200;
                                let width = img.width;
                                let height = img.height;

                                if (width > height) {
                                    if (width > MAX_WIDTH) {
                                        height *= MAX_WIDTH / width;
                                        width = MAX_WIDTH;
                                    }
                                } else {
                                    if (height > MAX_HEIGHT) {
                                        width *= MAX_HEIGHT / height;
                                        height = MAX_HEIGHT;
                                    }
                                }
                                
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);
                                
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                                resolve(dataUrl.split(',')[1]);
                            };
                            img.onerror = reject;
                            img.src = event.target.result;
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    imagesBase64List.push(base64);
                }

                const selectedFormat = document.getElementById('study-material-format')?.value || 'pdf-qa';
                const isExamMode = (selectedFormat === 'exam-focus');
                const isSummaryMode = (selectedFormat === 'summary');

                const foreignLanguages = ["اللغة الإنجليزية", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية", "english", "french", "german", "italian"];
                const isForeignLang = foreignLanguages.some(lang => subject.toLowerCase().includes(lang));
                const targetLang = isForeignLang ? "the EXACT specific foreign language of the subject (e.g., English, French, German, or Italian)" : "Arabic";

                let aiPrompt = `MANDATORY_STRICT_INSTRUCTION: YOU ARE THE CHIEF EXAM CREATOR FOR THE EGYPTIAN MINISTRY OF EDUCATION (2026). YOU MUST GENERATE CONTENT THAT EXACTLY MATCHES THE EGYPTIAN NATIONAL CURRICULUM EXAM STANDARDS FOR "${yearText}" IN SUBJECT "${subject}".
CRITICAL LANGUAGE INSTRUCTION: The output language MUST BE STRICTLY in ${targetLang}. If the subject is a foreign language, ALL questions, answers, and explanations MUST be written in that foreign language. Do not use Arabic unless it is a standard translation question explicitly required by the Egyptian Ministry.

OUTPUT FORMAT: You MUST return a JSON object containing an array named 'qa_data'. Each item in 'qa_data' must have: 'q' (the question or section title), 'a' (the answer or full explanation), 'reason' (detailed scientific/logical justification), 'type' (MCQ, TF, or ESSAY), and 'options' (array of 4 choices if MCQ).

MINISTRY SPECS BY SUBJECT:
1. IF SUMMARY MODE (${isSummaryMode}): Generate a highly detailed study summary matching Egyptian standards. Use clear comparisons, scientific reasons, and key concepts. NO EXAM QUESTIONS. Set type to 'ESSAY'.
2. ENGLISH LANGUAGE: ABSOLUTELY NO TRUE/FALSE. Use ONLY MCQ (Grammar/Vocab), Fill in the blanks (text with word box), Reading Comprehension MCQ, Unscramble sentences, and correct the grammar. 
3. SECOND LANGUAGES (FRENCH/GERMAN/ITALIAN): Use Reading Documents (True/False & MCQ), Daily Situations (MCQ), Grammar (MCQ), and short email production.
4. ARABIC LANGUAGE: Focus on Free Reading (قراءة متحررة), Poetry (نصوص متحررة), Grammar & Morphology (نحو وصرف) with parsing (إعراب) and extraction (استخراج).
5. SCIENCES & MATH: Focus on scientific reasons (علل/بم تفسر), comparisons, what happens if, laws, and applied problem-solving with full steps.
6. SOCIAL STUDIES: Focus on map deduction, historical results (ما النتائج المترتبة على), and evidence (دلل تاريخيا).
ALL MCQs AND TRUE/FALSE MUST HAVE DETAILED REASONS. THE TONE MUST BE 100% IDENTICAL TO OFFICIAL EGYPTIAN EXAMS. DO NOT DEVIATE.`;

                const serverPayload = {
                    action: 'analyze',
                    images_base64: imagesBase64List,
                    subject: subject,
                    year: yearText,
                    mime_type: 'image/jpeg',
                    output_language: 'same_as_source',
                    detailed_answers: true,
                    preserve_math_givens: true,
                    include_mcq_with_reasons: !isSummaryMode,
                    include_tf_with_reasons: !isSummaryMode,
                    hide_answers_in_exam: isExamMode,
                    strict_prompt_command: aiPrompt,
                    min_questions_per_section: isSummaryMode ? 5 : 5,
                    max_questions_per_section: isSummaryMode ? 20 : 15,
                    question_counts: {
                        mcq: isSummaryMode ? 0 : 5,
                        true_false: isSummaryMode ? 0 : 5,
                        essay: isSummaryMode ? 5 : 5,
                        strict_min_per_section: isSummaryMode ? 5 : 5,
                        strict_max_per_section: isSummaryMode ? 20 : 15
                    },
                    difficulty_levels: ["easy", "medium", "hard"]
                };

                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Bypass-Trial': 'true' 
                    },
                    body: JSON.stringify(serverPayload)
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || "فشل الاتصال بالسيرفر. الكود: " + response.status);
                }

                const finalServerResponse = await response.json();

                if (finalServerResponse.error) {
                    throw new Error(finalServerResponse.error);
                }

                existingData.current_version = { 
                    imageHash: newImageHash, 
                    aiData: finalServerResponse, 
                    lastUpdated: new Date().toISOString() 
                };
                
                await summaryRef.set(existingData);
                
                btnText.innerHTML = '<i class="fas fa-check"></i> تم إنهاء التحليل بنجاح';
                processBtn.classList.remove('processing');
                
                showOutput(finalServerResponse, subject);
                
                if (isVIPLoggedIn) {
                    updateGamification(50); 
                } else {
                    incrementAttempt();
                }
                
                setTimeout(() => { 
                    btnText.innerHTML = '🚀 تحليل صورة أخرى'; 
                }, 3000);
                
            } catch (error) {
                console.error("خطأ تقني:", error);
                btnText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> حدث خطأ';
                processBtn.classList.remove('processing');
                showCustomAlert("الخطأ التقني الحقيقي هو: \n" + error.message, 'error');
            }
        });
    }

    function showOutput(serverData, subjectName) {
        document.getElementById('ai-output-container').style.display = 'block';
        
        const selectedFormat = document.getElementById('study-material-format')?.value || 'pdf-qa';
        const isSummaryMode = (selectedFormat === 'summary');
        
        let creationDateObj = new Date(serverData.lastUpdated || Date.now());
        document.getElementById('ai-meta-info').innerHTML = '<i class="fas fa-cloud-download-alt"></i> تاريخ الإنشاء: ' + creationDateObj.toLocaleDateString('ar-EG') + ' | المادة: ' + stripParentheses(serverData.subjectTitle || subjectName);
        
        let resultHtml = '<div style="background: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 15px; text-align: center;">';
        resultHtml += '<h4 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #0ea5e9; display: inline-block; padding-bottom: 5px;">تمت المعالجة بنجاح للمادة: ' + stripParentheses(serverData.grade || "") + ' - ' + stripParentheses(subjectName) + '</h4>';
        
        if (isSummaryMode) {
            resultHtml += '<p style="color: #059669; line-height: 1.8; font-weight: bold; font-size: 1.1rem;">تم إنشاء مذكرة شاملة وتلخيص وافي للمنهج بنجاح طبقاً لمواصفات الوزارة.</p>';
            resultHtml += '<p style="color: #64748b; font-size: 0.95rem; margin-bottom: 20px;">الملخص الجاهز للطباعة يحتوي على المقارنات، الأسباب، وأهم النقاط.</p>';
            resultHtml += '<button id="native-print-btn" class="download-pdf-btn" style="background:#0ea5e9; margin-bottom: 10px;"><i class="fas fa-file-pdf"></i> تحميل / حفظ المذكرة كملف PDF</button></div>';
        } else {
            resultHtml += '<p style="color: #059669; line-height: 1.8; font-weight: bold; font-size: 1.1rem;">تم تلخيص الصور واستخراج بنك الأسئلة طبقاً للورقة الامتحانية المصرية بنجاح.</p>';
            resultHtml += '<p style="color: #64748b; font-size: 0.95rem; margin-bottom: 20px;">الأسئلة جاهزة الآن للطباعة أو التحميل كملف PDF.</p>';
            resultHtml += '<button id="native-print-btn" class="download-pdf-btn" style="background:#0ea5e9; margin-bottom: 10px;"><i class="fas fa-file-pdf"></i> تحميل / حفظ الأسئلة كملف PDF</button></div>';
        }

        document.getElementById('ai-response-text').innerHTML = resultHtml;
        globalLessonContext = JSON.stringify(serverData.qa_data);
        
        let btnContainer = document.getElementById('interactive-exam-btn-container');
        if (btnContainer) {
            btnContainer.innerHTML = '';
            if (!isSummaryMode) {
                interactiveExamData = serverData.qa_data.filter(q => q.type === "MCQ" || q.type === "TF" || q.type === "ESSAY");
                if (interactiveExamData.length > 0) {
                    btnContainer.innerHTML = `<button id="start-interactive-exam-btn" class="action-btn" style="background:#8b5cf6; margin-top:15px; width:100%;"><i class="fas fa-stopwatch"></i> بدء الامتحان التفاعلي أونلاين الآن</button>`;
                    document.getElementById('start-interactive-exam-btn').addEventListener('click', () => {
                        startInteractiveExam(subjectName);
                    });
                }
            }
        }
        
        // ============================================================================
        // محرك PDF النهائي (تأخير زمني + طباعة وهمية) لضمان عدم وجود ملفات بيضاء
        // ============================================================================
        document.getElementById('native-print-btn').addEventListener('click', async () => {
            const originalElement = document.getElementById('pdf-template');
            if (!originalElement) {
                showCustomAlert("تعذر العثور على قالب PDF داخل الصفحة.", "error");
                return;
            }

            try {
                showToast("جاري تجهيز محتوى الـ PDF... برجاء الانتظار ثواني", "#f59e0b");
                preparePDFDOM(serverData, subjectName);

                const contentElement = document.getElementById('pdf-qa-content');
                if (!contentElement || !contentElement.innerHTML.trim()) {
                    throw new Error("لم يتم العثور على محتوى داخل قالب PDF.");
                }

                // إنشاء نسخة مطابقة للقالب
                const pdfClone = originalElement.cloneNode(true);
                pdfClone.id = "pdf-template-render";
                
                // أهم جزء: لا نستخدم top: -9999 بل نجعله خلف الصفحة تماماً (z-index: -1000)
                pdfClone.style.display = "block";
                pdfClone.style.position = "absolute";
                pdfClone.style.left = "0";
                pdfClone.style.top = "0";
                pdfClone.style.width = "794px"; // عرض ورقة A4
                pdfClone.style.minHeight = "1123px";
                pdfClone.style.height = "auto";
                pdfClone.style.margin = "0";
                pdfClone.style.padding = "0";
                pdfClone.style.background = "#ffffff";
                pdfClone.style.color = "#000000";
                pdfClone.style.zIndex = "-1000"; // خلف الصفحة لكي يضطر المتصفح لرسمه
                pdfClone.style.pointerEvents = "none";
                pdfClone.style.overflow = "visible";

                const pdfInner = pdfClone.querySelector("#pdf-qa-content");
                if (pdfInner) {
                    pdfInner.style.display = "block";
                    pdfInner.style.visibility = "visible";
                    pdfInner.style.opacity = "1";
                    pdfInner.style.width = "100%";
                    pdfInner.style.height = "auto";
                    pdfInner.style.overflow = "visible";
                    pdfInner.style.background = "#ffffff";
                }

                // العلامة المائية الحقيقية التي تظهر في الـ PDF
                const oldWatermark = pdfClone.querySelector(".pdf-real-watermark");
                if (oldWatermark) {
                    oldWatermark.remove();
                }

                const watermark = document.createElement("div");
                watermark.className = "pdf-real-watermark";
                watermark.innerText = "Educational Platform";
                watermark.style.position = "absolute";
                watermark.style.left = "50%";
                watermark.style.top = "50%";
                watermark.style.transform = "translate(-50%, -50%) rotate(-35deg)";
                watermark.style.fontFamily = "Arial, sans-serif";
                watermark.style.fontSize = "58px";
                watermark.style.fontWeight = "900";
                watermark.style.color = "#0f172a";
                watermark.style.opacity = "0.07";
                watermark.style.whiteSpace = "nowrap";
                watermark.style.pointerEvents = "none";
                watermark.style.zIndex = "0"; // خلف النصوص

                pdfClone.insertBefore(watermark, pdfClone.firstChild);

                const pdfContentWrapper = pdfClone.querySelector("#pdf-qa-content");
                if (pdfContentWrapper) {
                    pdfContentWrapper.style.position = "relative";
                    pdfContentWrapper.style.zIndex = "2"; // فوق العلامة المائية
                }

                pdfClone.querySelectorAll(".pdf-question-block").forEach(block => {
                    block.style.position = "relative";
                    block.style.zIndex = "2";
                    block.style.backgroundColor = "rgba(248,250,252,0.96)";
                });

                document.body.appendChild(pdfClone);

                // التأكد من تحميل الخطوط
                if (document.fonts && document.fonts.ready) {
                    await document.fonts.ready;
                }

                const images = Array.from(pdfClone.querySelectorAll("img"));
                await Promise.all(images.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                }));

                // ------------------------------------------------------------
                // تأخير زمني إجباري (2 ثانية) بناءً على طلبك لضمان عدم طباعة صفحات بيضاء
                // ------------------------------------------------------------
                await new Promise(resolve => setTimeout(resolve, 2000));

                const finalContent = pdfClone.querySelector("#pdf-qa-content");
                if (!finalContent || finalContent.innerText.trim().length === 0) {
                    throw new Error("قالب PDF موجود ولكن محتوى الأسئلة فارغ.");
                }

                const opt = {
                    margin: [10, 10, 10, 10],
                    filename: "EduPlatform_" + String(subjectName || "Questions").replace(/[\\/:*?"<>|]/g, "_") + ".pdf",
                    image: { type: "jpeg", quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: "#ffffff",
                        logging: false,
                        scrollX: 0,
                        scrollY: 0,
                        windowWidth: 794,
                        windowHeight: Math.max(1123, pdfClone.scrollHeight)
                    },
                    pagebreak: { mode: ["css", "legacy"] },
                    jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true }
                };

                showToast("جاري تحويل وبناء ملف الـ PDF النهائي...", "#0ea5e9");

                await html2pdf().set(opt).from(pdfClone).save();

                // حذف النسخة المؤقتة بعد الطباعة
                pdfClone.remove();

                showToast("تم إنشاء ملف PDF بالكتابة والعلامة المائية بنجاح!", "#10b981");

            } catch (error) {
                console.error("PDF GENERATION ERROR:", error);
                const temporaryClone = document.getElementById("pdf-template-render");
                if (temporaryClone) {
                    temporaryClone.remove();
                }
                showCustomAlert("تعذر إنشاء ملف PDF بشكل صحيح.<br><br><strong>تفاصيل الخطأ:</strong><br>" + String(error.message || error), "error");
            }
        });
        
        document.getElementById('ai-output-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function preparePDFDOM(serverData, subjectName) {
        const selectedFormat = document.getElementById('study-material-format')?.value || 'pdf-qa';
        const isExamMode = (selectedFormat === 'exam-focus');
        const isSummaryMode = (selectedFormat === 'summary');

        let qaHtml = '';
        let questionCount = 0;
        
        const foreignLanguages = ["اللغة الإنجليزية", "اللغة الفرنسية", "اللغة الألمانية", "اللغة الإيطالية", "english", "french", "german", "italian"];
        const isForeignLang = foreignLanguages.some(lang => subjectName.toLowerCase().includes(lang));
        const textDirection = isForeignLang ? 'ltr' : 'rtl';
        const textAlign = isForeignLang ? 'left' : 'right';
        
        serverData.qa_data.forEach((item, index) => {
            questionCount++;
            let cleanQuestion = stripParentheses(item.q);
            
            let typeTitle = "";
            if (!isSummaryMode) {
                if (item.type === "MCQ") typeTitle = isForeignLang ? " [MCQ]" : " [اختيار من متعدد]";
                else if (item.type === "TF") typeTitle = isForeignLang ? " [True/False]" : " [صح أو خطأ]";
                else if (item.type === "ESSAY") typeTitle = isForeignLang ? " [Essay]" : " [سؤال مقالي]";
            }

            qaHtml += `<div class="pdf-question-block" style="margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border-${isForeignLang ? 'left' : 'right'}: 4px solid #10b981; direction: ${textDirection}; text-align: ${textAlign}; position: relative; z-index: 1; page-break-inside: avoid !important; break-inside: avoid !important;">`;
            
            if (isSummaryMode) {
                qaHtml += '<p style="color: #0f172a; margin: 0 0 12px 0; font-size: 16px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;"><strong><i class="fas fa-star" style="color:#f59e0b;"></i> ' + cleanQuestion + '</strong></p>';
                qaHtml += '<div style="margin: 10px 0 0 0; line-height: 1.9; font-size: 15px; color: #1e293b;">' + (item.a ? item.a.replace(/\n/g, '<br>') : '') + '</div>';
                if (item.reason) {
                    qaHtml += '<div style="margin: 10px 0 0 0; line-height: 1.9; font-size: 14px; color: #059669; font-weight: bold;">' + item.reason.replace(/\n/g, '<br>') + '</div>';
                }
            } else {
                let qPrefix = isForeignLang ? 'Q ' : 'س ';
                qaHtml += '<p style="color: #0f172a; margin: 0 0 8px 0; font-size: 15px;"><strong>' + qPrefix + questionCount + ': ' + cleanQuestion + typeTitle + '</strong></p>';
                
                if (item.options && Array.isArray(item.options) && item.options.length > 0) {
                    qaHtml += '<div style="margin: 10px 0; padding: 10px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1;">';
                    item.options.forEach((opt) => {
                        let cleanOpt = stripParentheses(opt);
                        let isThisCorrect = (!isExamMode && item.a && (item.a.includes(cleanOpt) || cleanOpt.includes(item.a)));
                        let correctMarkText = isForeignLang ? "(✓ Correct)" : "(✓ الإجابة الصحيحة)";
                        let mark = isThisCorrect ? ` <strong style='color:#059669;'>${correctMarkText}</strong>` : "";
                        qaHtml += '<div style="margin-bottom: 6px; color: #1e293b; font-size: 14px;">• ' + cleanOpt + mark + '</div>';
                    });
                    qaHtml += '</div>';
                }

                if (!isExamMode) {
                    let trueWords = ["صح", "true", "vrai", "richtig", "vero", "✓"];
                    if (item.type === "TF") {
                        let isTrueAns = item.a && trueWords.some(w => item.a.toLowerCase().includes(w));
                        let symbolMark = isTrueAns ? "[ ✓ ]" : "[ ✕ ]";
                        let colorMark = isTrueAns ? "#059669" : "#b45309";
                        let reasonLabel = isForeignLang ? "Scientific Reason:" : "السبب العلمي:";
                        qaHtml += `<p style="margin: 10px 0 0 0; font-size: 14px; font-weight: bold; color: ${colorMark};">${symbolMark}</p>`;
                        if (item.reason) {
                            qaHtml += '<p style="margin: 6px 0 0 0; line-height: 1.8; font-size: 13px; color: #334155;"><strong>' + reasonLabel + '</strong><br>' + item.reason.replace(/\n/g, '<br>') + '</p>';
                        }
                    } else {
                        let answerLabel = isForeignLang ? "Model Answer:" : "الإجابة النموذجية:";
                        let detailLabel = isForeignLang ? "Detailed Explanation:" : "السبب والتفسير العلمي الوافي:";
                        qaHtml += '<p style="margin: 10px 0 0 0; line-height: 1.8; font-size: 13px; color: #059669;"><strong>' + answerLabel + ' </strong><br>' + item.a.replace(/\n/g, '<br>') + '</p>';
                        if (item.reason) {
                            qaHtml += '<p style="margin: 8px 0 0 0; line-height: 1.8; font-size: 13px; color: #b45309;"><strong>' + detailLabel + '</strong><br>' + item.reason.replace(/\n/g, '<br>') + '</p>';
                        }
                    }
                } else {
                    qaHtml += '<div style="margin-top: 15px; border-bottom: 1px dashed #cbd5e1; height: 25px;"></div>';
                }
            }
            
            qaHtml += '</div>';
        });

        document.getElementById('pdf-qa-content').innerHTML = qaHtml;
        document.getElementById('pdf-qa-content').style.direction = textDirection;
        document.getElementById('pdf-qa-content').style.textAlign = textAlign;
        
        let headerPrefix = isSummaryMode ? (isForeignLang ? 'Summary | ' : 'مذكرة ملخص | ') : (isForeignLang ? 'Questions | ' : 'ملف أسئلة | ');
        document.getElementById('pdf-header-title').innerText = headerPrefix + stripParentheses(serverData.subjectTitle || subjectName) + ' | ' + stripParentheses(serverData.grade || "");
        
        let pdfCreationDate = new Date(serverData.lastUpdated || Date.now()).toLocaleDateString('ar-EG');
        let footerElement = document.querySelector('#pdf-template > div > div:last-child');
        
        if (footerElement) {
            let sectionsLabel = isSummaryMode ? (isForeignLang ? ' | Generated Sections: ' : ' | عدد الأقسام المستخرجة: ') : (isForeignLang ? ' | Generated Questions: ' : ' | عدد الأسئلة المستخرجة: ');
            let watermarkText = isForeignLang ? '<br>Generated by AI Educational Platform 2026' : '<br>تم التوليد بواسطة منصة الذكاء الاصطناعي 2026';
            let dateLabel = isForeignLang ? 'Creation Date: ' : 'تاريخ الإنشاء: ';
            footerElement.innerHTML = dateLabel + pdfCreationDate + sectionsLabel + questionCount + watermarkText;
        }
    }

    function startInteractiveExam(subjectName) {
        document.getElementById('ai-output-container').classList.add('hidden-section');
        const examContainer = document.getElementById('interactive-exam-container');
        examContainer.classList.remove('hidden-section');
        
        document.getElementById('exam-subject-title').innerText = subjectName;
        
        const questionsArea = document.getElementById('exam-questions-area');
        questionsArea.innerHTML = '';
        
        interactiveExamTotalTime = interactiveExamData.length * 120;
        interactiveExamTimeLeft = interactiveExamTotalTime;
        examStartTime = Date.now();
        
        updateTimerDisplay();
        interactiveExamTimer = setInterval(() => {
            interactiveExamTimeLeft--;
            updateTimerDisplay();
            if (interactiveExamTimeLeft <= 0) {
                clearInterval(interactiveExamTimer);
                submitInteractiveExam(true);
            }
        }, 1000);

        interactiveExamData.forEach((q, index) => {
            let qDiv = document.createElement('div');
            qDiv.className = 'interactive-q-card';
            
            let qTitle = `<div class="interactive-q-title">س ${index + 1}: ${stripParentheses(q.q)}</div>`;
            let optionsHtml = '<div class="interactive-options">';
            
            if (q.type === "MCQ" && q.options && q.options.length > 0) {
                q.options.forEach((opt, optIndex) => {
                    let cleanOpt = stripParentheses(opt);
                    let inputId = `q_${index}_opt_${optIndex}`;
                    optionsHtml += `
                        <label class="option-label" for="${inputId}">
                            <input type="radio" name="q_${index}" id="${inputId}" value="${cleanOpt}" class="option-input">
                            <span>${cleanOpt}</span>
                        </label>
                    `;
                });
                optionsHtml += `<textarea id="q_${index}_text" class="student-text-answer" placeholder="اكتب إجابتك هنا..." style="width:100%; margin-top:15px; padding:12px; border-radius:8px; border:2px solid #cbd5e1; font-family: 'Cairo', sans-serif; resize:vertical; font-weight:bold;"></textarea>`;
            } else if (q.type === "TF") {
                optionsHtml += `
                    <label class="option-label" for="q_${index}_true">
                        <input type="radio" name="q_${index}" id="q_${index}_true" value="صح" class="option-input">
                        <span>صواب (صح)</span>
                    </label>
                    <label class="option-label" for="q_${index}_false">
                        <input type="radio" name="q_${index}" id="q_${index}_false" value="خطأ" class="option-input">
                        <span>خطأ</span>
                    </label>
                `;
                optionsHtml += `<textarea id="q_${index}_text" class="student-text-answer" placeholder="اكتب إجابتك هنا..." style="width:100%; margin-top:15px; padding:12px; border-radius:8px; border:2px solid #cbd5e1; font-family: 'Cairo', sans-serif; resize:vertical; font-weight:bold;"></textarea>`;
            } else if (q.type === "ESSAY") {
                optionsHtml += `<textarea id="q_${index}_text" class="student-text-answer" placeholder="اكتب إجابتك هنا..." style="width:100%; margin-top:10px; padding:12px; border-radius:8px; border:2px solid #0ea5e9; font-family: 'Cairo', sans-serif; min-height:100px; resize:vertical; font-weight:bold; font-size:1.05rem;"></textarea>`;
            }
            
            optionsHtml += '</div>';
            optionsHtml += `<div id="feedback_${index}" class="result-feedback"></div>`;
            
            qDiv.innerHTML = qTitle + optionsHtml;
            questionsArea.appendChild(qDiv);
            
            let radios = qDiv.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => {
                radio.addEventListener('change', function() {
                    let labels = qDiv.querySelectorAll('.option-label');
                    labels.forEach(l => l.classList.remove('selected-opt'));
                    if(this.checked) {
                        this.parentElement.classList.add('selected-opt');
                    }
                });
            });
        });

        const submitBtn = document.getElementById('submit-interactive-exam-btn');
        submitBtn.style.display = 'inline-block';
        submitBtn.onclick = () => submitInteractiveExam(false);
        
        examContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function updateTimerDisplay() {
        let m = Math.floor(interactiveExamTimeLeft / 60);
        let s = interactiveExamTimeLeft % 60;
        document.getElementById('exam-time-display').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if (interactiveExamTimeLeft < 60) {
            document.getElementById('exam-time-display').style.color = '#ef4444';
        }
    }

    async function submitInteractiveExam(isTimeOut = false) {
        clearInterval(interactiveExamTimer);
        
        let score = 0;
        let total = interactiveExamData.length;
        let timeUsedSec = interactiveExamTotalTime - interactiveExamTimeLeft;
        
        const submitBtn = document.getElementById('submit-interactive-exam-btn');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التصحيح بالذكاء الاصطناعي...';
        submitBtn.style.pointerEvents = 'none';

        for (let index = 0; index < interactiveExamData.length; index++) {
            let q = interactiveExamData[index];
            let selectedRadio = document.querySelector(`input[name="q_${index}"]:checked`);
            let studentRadioAnswer = selectedRadio ? selectedRadio.value : null;
            let textInput = document.getElementById(`q_${index}_text`);
            let studentTextAnswer = textInput ? textInput.value.trim() : "";
            
            let feedbackDiv = document.getElementById(`feedback_${index}`);
            feedbackDiv.style.display = 'block';
            feedbackDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تقييم وفحص الإجابة...';
            
            let isCorrect = false;
            let aiFeedbackMsg = "";

            if (q.type === "MCQ" || q.type === "TF") {
                if (q.type === "MCQ") {
                    isCorrect = studentRadioAnswer && (q.a.includes(studentRadioAnswer) || studentRadioAnswer.includes(q.a));
                } else if (q.type === "TF") {
                    let correctAnswerStr = q.a.includes("صح") || q.a.includes("true") || q.a.includes("✓") ? "صح" : "خطأ";
                    isCorrect = studentRadioAnswer === correctAnswerStr;
                }
                
                if (isCorrect) score++;

                aiFeedbackMsg = `
                    <div style="font-size: 1.1rem; margin-bottom: 5px;"><strong>${isCorrect ? 'إجابة صحيحة ✓ (أنت ممتاز!)' : 'إجابة خاطئة ✕'}</strong></div>
                    ${!isCorrect ? `<div style="color: #0f172a; margin-bottom: 5px;"><strong>الإجابة العلمية المنطقية النصية بتقول:</strong> ${q.a}</div>` : ''}
                    <div style="margin-top:8px; font-size:0.95rem; color:#b45309;"><strong>السبب العلمي (ليه صح أو غلط):</strong> ${q.reason || 'لا يوجد تفسير إضافي'}</div>
                    ${studentTextAnswer ? `<div style="margin-top:8px; font-size:0.9rem; color:#64748b;"><strong>ملاحظاتك المكتوبة:</strong> ${studentTextAnswer}</div>` : ''}
                `;
                feedbackDiv.classList.add(isCorrect ? 'correct' : 'wrong');
                feedbackDiv.innerHTML = aiFeedbackMsg;

            } else if (q.type === "ESSAY") {
                if (!studentTextAnswer || studentTextAnswer.length < 2) {
                    isCorrect = false;
                    aiFeedbackMsg = `
                        <div style="font-size: 1.1rem; margin-bottom: 5px;"><strong>إجابة خاطئة ✕ (لم تقم بكتابة إجابة كافية)</strong></div>
                        <div style="color: #0f172a; margin-bottom: 5px;"><strong>الإجابة العلمية المنطقية النصية بتقول:</strong> ${q.a}</div>
                        <div style="margin-top:8px; font-size:0.95rem; color:#b45309;"><strong>السبب العلمي:</strong> ${q.reason || 'لا يوجد تفاصيل إضافية'}</div>
                    `;
                    feedbackDiv.classList.add('wrong');
                    feedbackDiv.innerHTML = aiFeedbackMsg;
                } else {
                    try {
                        const response = await fetch('/api/analyze', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'X-Bypass-Trial': 'true'
                            },
                            body: JSON.stringify({
                                action: 'semantic_grade',
                                question: q.q,
                                model_answer: q.a,
                                student_answer: studentTextAnswer
                            })
                        });
                        
                        const data = await response.json();
                        let replyText = data.reply || "{}";
                        let aiEval = JSON.parse(replyText);
                        
                        isCorrect = aiEval.isCorrect === true || aiEval.isCorrect === "true";
                        
                    } catch (e) {
                        console.error("AI Semantic Grading Failed:", e);
                        isCorrect = studentTextAnswer.length > 5; 
                    }

                    if (isCorrect) score++;

                    aiFeedbackMsg = `
                        <div style="font-size: 1.1rem; margin-bottom: 5px;"><strong>${isCorrect ? 'إجابة صحيحة ✓ (أنت ممتاز!)' : 'إجابة خاطئة ✕ (حاول التركيز أكثر)'}</strong></div>
                        <div style="color: #0f172a; margin-bottom: 5px;"><strong>الإجابة العلمية المنطقية النصية بتقول كذا كذا:</strong><br>${q.a}</div>
                        <div style="margin-top:8px; font-size:0.95rem; color:#b45309;"><strong>السبب والتفسير العلمي:</strong><br>${q.reason || 'لا توجد تفاصيل أخرى'}</div>
                    `;
                    feedbackDiv.classList.add(isCorrect ? 'correct' : 'wrong');
                    feedbackDiv.innerHTML = aiFeedbackMsg;
                }
            }
        }

        let percentage = Math.round((score / total) * 100);
        let resultMsg = isTimeOut ? "انتهى الوقت! " : "تم التصحيح والتسليم بنجاح! ";
        resultMsg += `نتيجتك النهائية: ${score} من ${total} (${percentage}%)`;
        
        showCustomAlert(resultMsg, percentage >= 50 ? 'success' : 'error');
        submitBtn.style.display = 'none';

        if (isVIPLoggedIn && score > 0) {
            updateGamification(score * 10);
            showToast(`ألف مبروك! كسبت ${score * 10} نقطة ذهبية جديدة`, "#f59e0b");
        }

        let analyticsRecord = {
            studentId: currentTeacherId || "زائر_غير_مسجل",
            subject: document.getElementById('exam-subject-title').innerText,
            score: score,
            totalQuestions: total,
            timeUsedSec: timeUsedSec,
            timestamp: Date.now()
        };

        if (navigator.onLine) {
            try {
                await db.collection("exam_analytics").add(analyticsRecord);
            } catch (e) {
                await localDBHelper.saveAnalyticsLocally(analyticsRecord);
            }
        } else {
            await localDBHelper.saveAnalyticsLocally(analyticsRecord);
        }
    }

    const tutorFabBtn = document.getElementById('tutor-fab-btn');
    const tutorImmersiveModal = document.getElementById('tutor-immersive-modal');
    const closeImmersiveBtn = document.getElementById('close-immersive-btn');
    const immersiveInput = document.getElementById('tutor-immersive-input');
    const immersiveSendBtn = document.getElementById('tutor-immersive-send-btn');
    const immersiveMessagesArea = document.getElementById('tutor-immersive-messages');
    
    // ============================================================================
    // إضافة نظام رفع الصور والتحدث الصوتي للروبوت (حلول الإيموشنات واللهجة)
    // ============================================================================
    const chatInputArea = document.querySelector('.tutor-chat-input-area');
    let chatUploadedImagesBase64 = [];

    if (chatInputArea && !document.getElementById('attach-ai-btn')) {
        
        const attachBtn = document.createElement('button');
        attachBtn.id = 'attach-ai-btn';
        attachBtn.innerHTML = '<i class="fas fa-paperclip"></i>';
        attachBtn.style.cssText = 'background: #0ea5e9; color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; box-shadow: 0 4px 10px rgba(14, 165, 233, 0.3); transition: 0.2s; margin-left: 8px; flex-shrink: 0;';
        
        const voiceBtn = document.createElement('button');
        voiceBtn.id = 'voice-ai-btn';
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.style.cssText = 'background: #f59e0b; color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3); transition: 0.2s; margin-left: 8px; flex-shrink: 0;';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        chatInputArea.insertBefore(voiceBtn, document.getElementById('tutor-immersive-input'));
        chatInputArea.insertBefore(attachBtn, document.getElementById('tutor-immersive-input'));
        chatInputArea.appendChild(fileInput);

        attachBtn.onclick = () => {
            fileInput.click();
        };
        
        fileInput.addEventListener('change', async (event) => {
            if (event.target.files.length > 0) {
                if (event.target.files.length > 10) {
                    showCustomAlert("عفواً، أقصى عدد للصور هو 10 صور فقط للمرة الواحدة.", "error");
                    event.target.value = "";
                    return;
                }
                chatUploadedImagesBase64 = [];
                for (let file of event.target.files) {
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                    chatUploadedImagesBase64.push(base64);
                }
                showToast(`تم إرفاق ${chatUploadedImagesBase64.length} صور للروبوت بنجاح!`, "#10b981");
                attachBtn.style.background = "#10b981"; 
            }
        });

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'ar-EG'; // اللهجة المصرية في التعرف
            recognition.onstart = () => {
                voiceBtn.style.background = '#ef4444';
            };
            recognition.onend = () => {
                voiceBtn.style.background = '#f59e0b';
            };
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('tutor-immersive-input').value = transcript;
                sendImmersiveQuestion();
            };
            voiceBtn.onclick = () => {
                recognition.start();
            };
        } else {
            voiceBtn.onclick = () => {
                showCustomAlert("عفواً، متصفحك الحالي لا يدعم ميزة التعرف الصوتي المباشر.", "error");
            };
        }
    }

    // فلتر قوي لمسح الإيموشنات قبل النطق الصوتي حتى لا يقرأها ككلمات
    function removeEmojisForTTS(text) {
        if (!text) return "";
        return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
    }

    function speakText(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            let cleanText = removeEmojisForTTS(text); // مسح الإيموشنات بالفلتر
            let utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'ar-EG'; // النطق باللهجة المصرية
            utterance.rate = 1.05; 
            window.speechSynthesis.speak(utterance);
        }
    }

    if (tutorFabBtn && tutorImmersiveModal) {
        tutorFabBtn.onclick = (e) => {
            e.preventDefault();
            tutorImmersiveModal.classList.remove('hidden-section');
            tutorImmersiveModal.classList.add('active');
            init3DRobot();
        };
    }

    if (closeImmersiveBtn) {
        closeImmersiveBtn.addEventListener('click', () => {
            tutorImmersiveModal.classList.remove('active');
            setTimeout(() => tutorImmersiveModal.classList.add('hidden-section'), 400);
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        });
    }

    function appendImmersiveMessage(text, sender) {
        if (!immersiveMessagesArea) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = sender === 'user' ? 'tutor-msg user-msg' : 'tutor-msg bot-msg';
        msgDiv.innerHTML = text.replace(/\n/g, '<br>');
        immersiveMessagesArea.appendChild(msgDiv);
        immersiveMessagesArea.scrollTop = immersiveMessagesArea.scrollHeight;
    }

    async function sendImmersiveQuestion() {
        const text = immersiveInput.value.trim();
        if (!text && chatUploadedImagesBase64.length === 0) return;
        
        let displayUserMsg = text;
        if (chatUploadedImagesBase64.length > 0) {
            displayUserMsg += `<br><span style="color:#f59e0b; font-size:0.85rem;"><i class="fas fa-image"></i> (مرفق ${chatUploadedImagesBase64.length} صور)</span>`;
        }
        
        appendImmersiveMessage(displayUserMsg || "أرجو شرح الصور المرفقة", 'user');
        immersiveInput.value = '';

        const typingId = 'imm-typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'tutor-msg bot-msg';
        typingDiv.innerHTML = '<i class="fas fa-ellipsis-h fa-fade"></i> جاري التفكير...';
        immersiveMessagesArea.appendChild(typingDiv);
        immersiveMessagesArea.scrollTop = immersiveMessagesArea.scrollHeight;

        let finalReply = "";

        try {
            if (chatUploadedImagesBase64.length > 0) {
                let chatPrompt = `الطالب يسألك بخصوص الصور المرفقة ويقول: "${text}". اشرح له بأسلوب مبسط جداً وبالعامية المصرية الطبيعية (كأنك مدرس مصري خبير). لا تستخدم اللغة العربية الفصحى المعقدة. هام جداً: يجب أن يكون الرد مصفوفة JSON متوافقة تماماً مع هذا التنسيق: {"brief_explanation": "اكتب الشرح المباشر للطالب هنا", "qa_list": []}`;
                
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Bypass-Trial': 'true'
                    },
                    body: JSON.stringify({
                        action: 'analyze',
                        images_base64: chatUploadedImagesBase64,
                        subject: 'سؤال حر',
                        year: 'عام',
                        mime_type: 'image/jpeg',
                        strict_prompt_command: chatPrompt
                    })
                });

                if (!response.ok) throw new Error("Server error");
                const data = await response.json();
                finalReply = data.brief_explanation || "تم استلام الصور ولكن لم أتمكن من استخراج الشرح المباشر.";
                
                chatUploadedImagesBase64 = [];
                const attachBtn = document.getElementById('attach-ai-btn');
                if (attachBtn) attachBtn.style.background = "#0ea5e9"; 

            } else {
                let currentYear = document.getElementById('year-stage')?.options[document.getElementById('year-stage')?.selectedIndex]?.text || "غير محدد";
                let mainStageVal = document.getElementById('main-stage')?.value || "";
                
                let customPrompt = "MANDATORY_STRICT_INSTRUCTION: YOU ARE A FRIENDLY, HUMAN-LIKE EXPERT EGYPTIAN TEACHER. ";
                customPrompt += "CRITICAL RULE: YOU MUST EXPLAIN IN NATURAL EGYPTIAN ARABIC DIALECT (العامية المصرية البسيطة). DO NOT USE COMPLEX FORMAL ARABIC. ";
                customPrompt += "YOU MUST RESPOND IMMEDIATELY AND DIRECTLY TO THE STUDENT'S QUESTION. ";
                
                if (mainStageVal.includes('primary')) {
                    customPrompt += "THE STUDENT IS IN PRIMARY SCHOOL (" + currentYear + "). EXPLAIN IN A VERY SIMPLE, CLEAR, AND ENGAGING WAY SUITABLE FOR CHILDREN.";
                } else if (mainStageVal.includes('prep')) {
                    customPrompt += "THE STUDENT IS IN PREPARATORY SCHOOL (" + currentYear + "). EXPLAIN SIMPLY BUT PROVIDE A COMPREHENSIVE AND STRUCTURED EXPLANATION FOR THE QUESTION.";
                } else if (mainStageVal.includes('high') || mainStageVal.includes('diploma')) {
                    customPrompt += "THE STUDENT IS IN SECONDARY SCHOOL/DIPLOMA (" + currentYear + "). EXPLAIN USING ALL AVAILABLE METHODS, PROVIDE DEEP ACADEMIC ANALYSIS, EXAMPLES, AND THOROUGH DETAILS.";
                }

                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Bypass-Trial': 'true'
                    },
                    body: JSON.stringify({
                        action: 'chat',
                        message: text,
                        context: globalLessonContext,
                        strict_prompt_command: customPrompt
                    })
                });

                if (!response.ok) throw new Error("Server error");
                const data = await response.json();
                finalReply = data.answer || data.reply || data.message || "لا يوجد رد متاح.";
            }

            document.getElementById(typingId).remove();
            appendImmersiveMessage(finalReply, 'bot');
            
            startRobotTalking(finalReply.length * 50);
            speakText(finalReply); // نطق الرد فوراً بالصوت المصري وبدون إيموشنات
            
        } catch (err) {
            if(document.getElementById(typingId)) document.getElementById(typingId).remove();
            appendImmersiveMessage("عذراً، حدث خطأ في الاتصال بالشبكة. 🤖", 'bot');
        }
    }

    if (immersiveSendBtn && immersiveInput) {
        immersiveSendBtn.addEventListener('click', sendImmersiveQuestion);
        immersiveInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendImmersiveQuestion();
        });
    }

    let robotHeadGroup = null;
    let robotJaw = null;
    let isRobotTalking = false;
    let mouseX = 0;
    let mouseY = 0;

    function init3DRobot() {
        const container = document.getElementById('tutor-3d-canvas-container');
        if (!container || typeof THREE === 'undefined') return;
        
        if (container.innerHTML.includes('canvas')) return;
        container.innerHTML = ''; 

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0, 7); 

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio); 
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(2, 5, 5);
        scene.add(dirLight);

        robotHeadGroup = new THREE.Group();

        const headGeo = new THREE.BoxGeometry(2.4, 1.8, 2.2);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.5 });
        const upperHead = new THREE.Mesh(headGeo, headMat);
        upperHead.position.set(0, 0.5, 0);
        robotHeadGroup.add(upperHead);

        const visorGeo = new THREE.BoxGeometry(2.45, 0.7, 2.25);
        const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 0.6, 0);
        robotHeadGroup.add(visor);

        const eyeGeo = new THREE.CircleGeometry(0.18, 32);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.6, 0.6, 1.13);
        robotHeadGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.6, 0.6, 1.13);
        robotHeadGroup.add(rightEye);

        const jawGeo = new THREE.BoxGeometry(2.3, 0.7, 2.1);
        const jawMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
        robotJaw = new THREE.Mesh(jawGeo, jawMat);
        robotJaw.position.set(0, -0.8, 0);
        robotHeadGroup.add(robotJaw);

        const mouthGeo = new THREE.BoxGeometry(1.8, 0.9, 1.8);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 }); 
        const mouthCore = new THREE.Mesh(mouthGeo, mouthMat);
        mouthCore.position.set(0, -0.4, 0);
        robotHeadGroup.add(mouthCore);

        scene.add(robotHeadGroup);

        const placeholder = container.querySelector('.tutor-3d-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        const clock = new THREE.Clock();
        
        function animate() {
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            if (robotHeadGroup) {
                robotHeadGroup.rotation.y += (mouseX * 0.4 - robotHeadGroup.rotation.y) * 0.1;
                robotHeadGroup.rotation.x += (-mouseY * 0.2 - robotHeadGroup.rotation.x) * 0.1;
                robotHeadGroup.position.y = Math.sin(time * 2) * 0.1;

                if (isRobotTalking && robotJaw) {
                    const jawDrop = Math.abs(Math.sin(time * 20)) * 0.25; 
                    robotJaw.position.y = -0.8 - jawDrop; 
                } else if (robotJaw) {
                    robotJaw.position.y = -0.8; 
                }
            }
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            if (container.clientWidth > 0 && container.clientHeight > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });
    }

    function startRobotTalking(durationMs) {
        isRobotTalking = true;
        setTimeout(() => {
            isRobotTalking = false;
        }, durationMs);
    }

}); // نهاية المستند
