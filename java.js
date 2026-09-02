// @ts-nocheck
// ============================================================================
// ملف الجافاسكريبت الرئيسي (java.js) - منصة الذكاء الاصطناعي
// النسخة الأصلية (100% كاملة) + دعم PWA Offline + الداش بورد كاملة + المعلم التفاعلي 3D + محاكي الامتحان التفاعلي (مع التصحيح الذكي)
// ============================================================================

// ----------------------------------------------------------------------------
// نظام مراقبة الجلسة (Session Timeout) - 10 دقائق من عدم التفاعل
// ----------------------------------------------------------------------------
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

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
            showCustomAlert("تم تسجيل الخروج التلقائي لحماية حسابك بسبب عدم التفاعل لمدة 10 دقائق. يرجى تسجيل الدخول مجدداً.", 'error');
        }
    }
}

['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, resetSessionTimer);
});

setInterval(checkSessionTimeout, 60000);
// ----------------------------------------------------------------------------

window.addEventListener('load', () => {
    setTimeout(() => {
        const customSplash = document.getElementById('custom-splash-screen');
        if (customSplash) {
            customSplash.style.opacity = '0';
            customSplash.style.visibility = 'hidden';
            setTimeout(() => customSplash.remove(), 800);
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

// ============================================================================
// نظام الـ IndexedDB والمزامنة في الخلفية (Background Sync) للـ PWA
// ============================================================================
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
        } catch(e) { console.error("IndexedDB Save Error:", e); }
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

// ============================================================================
// نظام النوافذ المنبثقة الاحترافية
// ============================================================================
function showCustomAlert(message, type = 'error') {
    if (document.getElementById('custom-alert-overlay')) {
        document.getElementById('custom-alert-overlay').remove();
    }

    let icon = type === 'error' ? '<i class="fas fa-exclamation-triangle" style="color:#ef4444; font-size: 3rem; margin-bottom: 15px;"></i>' : '<i class="fas fa-check-circle" style="color:#10b981; font-size: 3rem; margin-bottom: 15px;"></i>';
    let titleColor = type === 'error' ? '#ef4444' : '#10b981';
    let btnColor = type === 'error' ? '#ef4444' : '#10b981';

    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:99999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(5px); padding:20px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:400px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; padding:30px 20px; border-top: 5px solid ${titleColor}; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            ${icon}
            <h3 style="margin: 0 0 15px 0; color:#0f172a; font-size:1.4rem;">تنبيه النظام</h3>
            <p style="color:#475569; font-size:1.1rem; line-height:1.6; margin-bottom:25px; font-weight:bold;">${message}</p>
            <button onclick="document.getElementById('custom-alert-overlay').remove()" style="background:${btnColor}; color:white; border:none; padding:12px 30px; font-size:1.1rem; border-radius:10px; font-weight:bold; cursor:pointer; width:100%; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:0.3s;">حسناً</button>
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
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:99999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(5px); padding:20px; overflow-y:auto;';
    
    overlay.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:400px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); text-align:center; padding:30px 20px; border-top: 5px solid #f59e0b; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            <i class="fas fa-question-circle" style="color:#f59e0b; font-size: 3rem; margin-bottom: 15px;"></i>
            <h3 style="margin: 0 0 15px 0; color:#0f172a; font-size:1.4rem;">تأكيد الإجراء</h3>
            <p style="color:#475569; font-size:1.1rem; line-height:1.6; margin-bottom:25px; font-weight:bold;">${message}</p>
            <div style="display:flex; gap:10px;">
                <button id="custom-confirm-yes" style="flex:1; background:#f59e0b; color:white; border:none; padding:12px; font-size:1.1rem; border-radius:10px; font-weight:bold; cursor:pointer; box-shadow:0 4px 12px rgba(245, 158, 11, 0.2);">نعم، متأكد</button>
                <button id="custom-confirm-no" style="flex:1; background:#f1f5f9; color:#475569; border:none; padding:12px; font-size:1.1rem; border-radius:10px; font-weight:bold; cursor:pointer;">إلغاء</button>
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

// ============================================================================
// 1. نظام شاشة تسجيل الدخول الأمني
// ============================================================================
function createAuthScreen() {
    if (document.getElementById('auth-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.85); z-index:999999; display:none; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; overflow-y:auto; font-family: "Cairo", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; backdrop-filter: blur(8px); padding: 20px; box-sizing: border-box;';
    
    overlay.innerHTML = `
        <div style="width:100%; max-width:440px; background:#ffffff; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border-top: 5px solid #0ea5e9; margin: auto; max-height: 95vh; overflow-y: auto;">
            <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:30px 20px; text-align:center; color:white;">
                <img src="1234.jpg" alt="Logo" style="width: 140px; height: auto; border-radius: 18px; margin-bottom: 15px; box-shadow: 0 8px 25px rgba(0,0,0,0.4);">
                <p style="font-size:1rem; color:#cbd5e1; margin:0; font-weight:bold;">منصة الذكاء الاصطناعي التعليمية المتقدمة</p>
            </div>
            
            <div id="auth-user-card" style="padding:30px 25px; text-align:center;">
                <h3 style="color:#1e293b; margin-top:0; margin-bottom:8px; font-size:1.3rem;">تسجيل الدخول للمنصة</h3>
                <p style="color:#64748b; font-size:0.95rem; margin-bottom:20px;">أدخل رقم الموبايل والرقم السري للوصول إلى المنصة</p>
                
                <input type="tel" id="auth-phone" autocomplete="off" placeholder="رقم الموبايل (مثال: 010xxxxxxxx)" style="width:100%; padding:15px; font-size:1.1rem; border:2px solid #e2e8f0; border-radius:10px; margin-bottom:12px; box-sizing:border-box; direction:rtl; text-align:center; font-weight:bold;">
                <input type="password" id="auth-password" autocomplete="off" placeholder="الرقم السري للطالب (أنشئه إذا كانت أول مرة)" style="width:100%; padding:15px; font-size:1.1rem; border:2px solid #e2e8f0; border-radius:10px; margin-bottom:18px; box-sizing:border-box; direction:rtl; text-align:center; font-weight:bold;">
                
                <button id="auth-login-btn" style="width:100%; background:#0ea5e9; color:white; border:none; padding:15px; font-size:1.15rem; border-radius:10px; font-weight:bold; cursor:pointer; transition:0.3s; box-shadow:0 4px 12px rgba(14,165,233,0.3);"><i class="fas fa-sign-in-alt"></i> دخول المنصة</button>
                <div style="border-bottom:1px solid #e2e8f0; margin:22px 0;"></div>
                <button id="auth-close-btn" style="width:100%; background:#f1f5f9; color:#475569; border:none; padding:12px; font-size:0.95rem; border-radius:8px; font-weight:bold; cursor:pointer;">تصفح المنصة كزائر (محاولات مجانية محدودة)</button>
            </div>

            <div id="auth-payment-card" style="padding:30px 25px; text-align:center; display:none;">
                <div style="width:50px; height:50px; background:#fef3c7; color:#b45309; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:1.5rem; margin-bottom:10px;"><i class="fas fa-crown"></i></div>
                <h3 style="color:#1e293b; margin-top:0; margin-bottom:8px;">تفعيل عضوية VIP</h3>
                <p style="color:#64748b; font-size:0.95rem; margin-bottom:15px;">الاشتراك المطلوب: <span id="auth-price-text" style="font-weight:bold; color:#1e293b; font-size:1.2rem;"></span> جنيه مصري</p>
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:15px; margin-bottom:18px; font-size:0.9rem; line-height:1.7; color:#334155;">
                    قم بالتحويل لفودافون كاش على الرقم <strong style="color:#0ea5e9; font-size:1.05rem;" dir="ltr">01026336159</strong><br>
                    وبعد إتمام التحويل، اضغط على الزر بالأسفل لطلب التفعيل وسنقوم بتوجيهك للواتس آب.
                </div>
                
                <button id="auth-request-btn" style="width:100%; background:#10b981; color:white; border:none; padding:14px; font-size:1.1rem; border-radius:10px; font-weight:bold; cursor:pointer; margin-bottom:12px; box-shadow:0 4px 12px rgba(16,185,129,0.3);"><i class="fas fa-paper-plane"></i> تأكيد الدفع وطلب التفعيل</button>
                <button id="auth-back-btn" style="width:100%; background:#f1f5f9; color:#475569; border:none; padding:12px; font-size:0.95rem; border-radius:8px; font-weight:bold; cursor:pointer;">رجوع</button>
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

    document.getElementById('auth-login-btn').addEventListener('click', handleUserLogin);
    document.getElementById('auth-request-btn').addEventListener('click', handlePaymentRequest);
}

function showAuthScreen() {
    createAuthScreen();
    const phoneInput = document.getElementById('auth-phone');
    const passInput = document.getElementById('auth-password');
    if (phoneInput) phoneInput.value = '';
    if (passInput) passInput.value = '';
    
    document.getElementById('auth-user-card').style.display = 'block';
    document.getElementById('auth-payment-card').style.display = 'none';
    document.getElementById('auth-overlay').style.display = 'flex';
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
    } catch (e) {
        console.error("Error logging admin expiration notification:", e);
    }
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

async function fetchDeviceIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch (error) {
        return "IP_UNKNOWN";
    }
}

function openAdminCreatePasswordModal(callback) {
    if (document.getElementById('custom-admin-create-pass-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'custom-admin-create-pass-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:9999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(6px); padding:20px; overflow-y:auto;';
    
    modal.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:420px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4); border-top: 5px solid #10b981; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            <div style="padding:22px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:38px; height:38px; background:#d1fae5; color:#10b981; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem;"><i class="fas fa-lock"></i></div>
                    <h3 style="margin:0; color:#0f172a; font-size:1.15rem; font-weight:bold;">إعداد الرقم السري للإدارة</h3>
                </div>
            </div>
            <div style="padding:25px 20px;">
                <p style="color:#64748b; font-size:0.92rem; margin-top:0; margin-bottom:18px; line-height:1.6;">مرحباً بك كمسؤول. يجب عليك إنشاء رقم سري جديد لحماية لوحة التحكم الخاصة بك.</p>
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:0.9rem; color:#334155; margin-bottom:8px; font-weight:bold;">الرقم السري الجديد:</label>
                    <input type="password" id="admin-new-pass-input" placeholder="أدخل الرقم السري..." style="width:100%; padding:14px; border:2px solid #cbd5e1; border-radius:10px; font-size:1.1rem; box-sizing:border-box; text-align:center; font-weight:bold; letter-spacing:2px;">
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block; font-size:0.9rem; color:#334155; margin-bottom:8px; font-weight:bold;">تأكيد الرقم السري:</label>
                    <input type="password" id="admin-confirm-pass-input" placeholder="أعد إدخال الرقم السري..." style="width:100%; padding:14px; border:2px solid #cbd5e1; border-radius:10px; font-size:1.1rem; box-sizing:border-box; text-align:center; font-weight:bold; letter-spacing:2px;">
                </div>
                <div style="display:flex; gap:12px;">
                    <button id="admin-create-pass-submit" style="flex:1; background:#10b981; color:white; border:none; padding:13px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:1rem; box-shadow:0 4px 12px rgba(16,185,129,0.3);"><i class="fas fa-save"></i> حفظ ودخول</button>
                    <button id="admin-create-pass-cancel" style="background:#f1f5f9; color:#475569; border:none; padding:13px 20px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:1rem;">إلغاء</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const newPassInput = document.getElementById('admin-new-pass-input');
    const confirmPassInput = document.getElementById('admin-confirm-pass-input');
    newPassInput.focus();

    document.getElementById('admin-create-pass-submit').addEventListener('click', () => {
        let val1 = newPassInput.value.trim();
        let val2 = confirmPassInput.value.trim();
        if(val1.length < 4) {
            showCustomAlert("يجب ألا يقل الرقم السري عن 4 خانات.", 'error');
            return;
        }
        if(val1 !== val2) {
            showCustomAlert("الرقم السري غير متطابق، برجاء التأكد.", 'error');
            return;
        }
        modal.remove();
        callback(val1);
    });

    document.getElementById('admin-create-pass-cancel').addEventListener('click', () => {
        modal.remove();
        callback(null);
    });
}

function openAdminPasswordModal(callback) {
    if (document.getElementById('custom-admin-pass-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'custom-admin-pass-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.8); z-index:9999999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; direction:rtl; font-family: "Cairo", sans-serif; backdrop-filter: blur(6px); padding:20px; overflow-y:auto;';
    
    modal.innerHTML = `
        <div style="background:#ffffff; width:100%; max-width:420px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4); border-top: 5px solid #0ea5e9; animation: scaleInAlert 0.3s ease; margin: auto; max-height: 95vh; overflow-y: auto;">
            <div style="padding:22px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:38px; height:38px; background:#e0f2fe; color:#0ea5e9; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem;"><i class="fas fa-shield-alt"></i></div>
                    <h3 style="margin:0; color:#0f172a; font-size:1.15rem; font-weight:bold;">التحقق الأمني للإدارة</h3>
                </div>
            </div>
            <div style="padding:25px 20px;">
                <p style="color:#64748b; font-size:0.92rem; margin-top:0; margin-bottom:18px; line-height:1.6;">هذا الرقم مسجل ضمن صلاحيات الإدارة العليا. يجبر النظام إدخال الرقم السري للمتابعة.</p>
                <div style="margin-bottom:20px;">
                    <label style="display:block; font-size:0.9rem; color:#334155; margin-bottom:8px; font-weight:bold;">الرقم السري للإدارة:</label>
                    <input type="password" id="admin-pass-input" placeholder="أدخل الرقم السري..." style="width:100%; padding:14px; border:2px solid #cbd5e1; border-radius:10px; font-size:1.1rem; box-sizing:border-box; text-align:center; font-weight:bold; letter-spacing:2px;">
                </div>
                <div style="display:flex; gap:12px;">
                    <button id="admin-pass-submit" style="flex:1; background:#0ea5e9; color:white; border:none; padding:13px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:1rem; box-shadow:0 4px 12px rgba(14,165,233,0.3);"><i class="fas fa-check-circle"></i> دخول</button>
                    <button id="admin-pass-cancel" style="background:#f1f5f9; color:#475569; border:none; padding:13px 20px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:1rem;">إلغاء</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const inputField = document.getElementById('admin-pass-input');
    inputField.focus();

    document.getElementById('admin-pass-submit').addEventListener('click', () => {
        let val = inputField.value.trim();
        modal.remove();
        callback(val);
    });

    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            let val = inputField.value.trim();
            modal.remove();
            callback(val);
        }
    });

    document.getElementById('admin-pass-cancel').addEventListener('click', () => {
        modal.remove();
        callback(null);
    });
}

async function handleUserLogin() {
    const phone = document.getElementById('auth-phone').value.trim();
    const password = document.getElementById('auth-password') ? document.getElementById('auth-password').value.trim() : "";

    if (phone.length < 10 || password.length < 4) {
        showCustomAlert("برجاء إدخال رقم موبايل صحيح، ورقم سري لا يقل عن 4 خانات.", 'error');
        return;
    }
    
    const btn = document.getElementById('auth-login-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
    
    currentTeacherId = phone;
    const currentIP = await fetchDeviceIP(); 
    let deviceFingerprint = localStorage.getItem("device_fingerprint") || ("DEV_" + Math.random().toString(36).substring(2, 15));
    localStorage.setItem("device_fingerprint", deviceFingerprint);

    try {
        const teacherRef = db.collection("teachers").doc(currentTeacherId);
        const doc = await teacherRef.get();
        let teacherData = {};

        let isAuthorizedAdmin = AUTHORIZED_ADMIN_PHONES.includes(phone);
        let assignedRole = isAuthorizedAdmin ? "Admin" : "User";

        if (doc.exists) {
            teacherData = doc.data();
            if (teacherData.role === "Admin") {
                isAuthorizedAdmin = true;
                assignedRole = "Admin";
            }
        }

        if (isAuthorizedAdmin) {
            let hasAdminPass = teacherData.adminPassword && teacherData.adminPassword !== "1234";

            if (!hasAdminPass) {
                openAdminCreatePasswordModal(async (newPassword) => {
                    if (!newPassword) {
                        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                        return;
                    }
                    await teacherRef.set({
                        name: "Admin_" + phone,
                        phone: phone,
                        status: "VIP_Active",
                        role: "Admin",
                        adminPassword: newPassword,
                        lastKnownIP: currentIP,
                        createdAt: teacherData.createdAt || new Date()
                    }, { merge: true });
                    
                    loginSuccess(phone, "Admin");
                    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                });
            } else {
                let savedPassword = teacherData.adminPassword;
                openAdminPasswordModal(async (enteredPassword) => {
                    if (!enteredPassword) {
                        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                        return; 
                    }

                    if (enteredPassword !== savedPassword) {
                        showCustomAlert("الرقم السري للإدارة غير صحيح! تم رفض الدخول.", 'error');
                        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                        return;
                    }

                    await finishLoginProcess(teacherRef, doc, teacherData, phone, password, currentIP, deviceFingerprint, isAuthorizedAdmin, assignedRole, btn);
                });
            }
            return;
        }

        await finishLoginProcess(teacherRef, doc, teacherData, phone, password, currentIP, deviceFingerprint, isAuthorizedAdmin, assignedRole, btn);
        
    } catch (e) {
        showCustomAlert("خطأ في الاتصال بقاعدة البيانات: " + e.message, 'error');
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
    }
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
    if (isVIPLoggedIn && (currentUserRole === 'Admin' || currentUserRole === 'Teacher')) return true;

    let hasUsedTrial = localStorage.getItem('has_used_free_trial_v2');
    let trialEnd = localStorage.getItem('free_trial_end_time');

    if (!hasUsedTrial) {
        showFreeTrialSelectionModal();
        return false;
    }

    if (trialEnd && Date.now() > parseInt(trialEnd)) {
        showCustomAlert("انتهت فترة التجربة المجانية الخاصة بك نهائياً. يجب عليك تفعيل عضويتك أو الدفع لكل مادة للمتابعة.", 'error');
        setTimeout(() => { showAuthScreen(); }, 1500);
        return false;
    }

    return true; 
}

async function finishLoginProcess(teacherRef, doc, teacherData, phone, password, currentIP, deviceFingerprint, isAuthorizedAdmin, assignedRole, btn) {
    if (doc.exists) {
        if (!isAuthorizedAdmin) {
            teacherData = doc.data();
            
            if (teacherData.studentPassword) {
                if (teacherData.studentPassword !== password) {
                    showCustomAlert("الرقم السري غير صحيح! تأكد من بياناتك.", 'error');
                    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                    return;
                }
            } else {
                await teacherRef.update({ studentPassword: password });
            }

            let isExemptFromDeviceLock = MULTI_DEVICE_PHONES.includes(phone) || isAuthorizedAdmin;

            if (teacherData.registeredDeviceFingerprint) {
                if (teacherData.registeredDeviceFingerprint !== deviceFingerprint && !isExemptFromDeviceLock) {
                    showCustomAlert("عذراً، هذا الحساب مرتبط بجهاز آخر. لا يمكنك الدخول من هنا لحماية أمان حسابك.", 'error');
                    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
                    return;
                }
            }
            await teacherRef.update({ registeredDeviceFingerprint: deviceFingerprint });
        }

        if (!isAuthorizedAdmin && teacherData.status === "Pending_Review") {
            showCustomAlert("حسابك قيد المراجعة حالياً. يرجى الانتظار حتى يتم تأكيد التحويل وتفعيل اشتراكك من قبل الإدارة.", 'error');
            document.getElementById('auth-user-card').style.display = 'none';
            document.getElementById('auth-payment-card').style.display = 'block';
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
            return; 
        }

        let isExpired = await checkAndLockIfExpired(phone, teacherData);
        if (isExpired && !isAuthorizedAdmin) {
            showCustomAlert("انتهت مدة اشتراكك. يجب تجديد الاشتراك للمتابعة.", 'error');
            document.getElementById('auth-user-card').style.display = 'none';
            document.getElementById('auth-payment-card').style.display = 'block';
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';
            return;
        }

    } else {
        teacherData = {
            name: isAuthorizedAdmin ? ("Admin_" + phone) : ("Student_" + phone),
            phone: phone,
            studentPassword: isAuthorizedAdmin ? null : password, 
            registeredDeviceFingerprint: deviceFingerprint,
            monthsSubscribed: 0,
            status: isAuthorizedAdmin ? "VIP_Active" : "Free",
            role: assignedRole,
            adminPassword: isAuthorizedAdmin ? "1234" : null,
            lastKnownIP: currentIP,
            createdAt: new Date()
        };
        await teacherRef.set(teacherData);
    }

    await teacherRef.update({ lastKnownIP: currentIP, role: assignedRole });
    loginSuccess(phone, assignedRole);
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> دخول المنصة';

    if (teacherData.status === "Free" && !isAuthorizedAdmin) {
        setTimeout(() => {
            checkFreeTrialAndAccess();
        }, 800);
    }
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
    setTimeout(() => { toast.style.top = '20px'; }, 100);
    setTimeout(() => { toast.style.top = '-100px'; }, 3500);
}

function loginSuccess(phone, role) {
    isVIPLoggedIn = true;
    currentUserRole = role;
    currentTeacherId = phone;
    
    localStorage.setItem('saved_user_phone', phone);
    localStorage.setItem('saved_user_role', role);
    resetSessionTimer();

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

    document.getElementById('change-pass-close-x').onclick = () => modal.remove();
    document.getElementById('cp-cancel-btn').onclick = () => modal.remove();

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
    
    let html = `
        <h3 style="color:#0f172a; margin-top:0;"><i class="fas fa-user-check"></i> الحساب مفعل (VIP)</h3>
        <p style="color:#64748b; font-weight:bold; margin-bottom:15px;">رقم الحساب: <span dir="ltr">${phone}</span></p>
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
    if (recordBtn) recordBtn.addEventListener('click', startTeacherRecordingAction);
    
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

async function loadAndShowDashboard() {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') {
        showCustomAlert("غير مصرح لك بالوصول إلى لوحة التحكم.", 'error');
        return;
    }

    let container = document.getElementById("custom-admin-dashboard-container");
    if (container) container.remove();

    const isMobile = window.innerWidth <= 768;

    container = document.createElement('div');
    container.id = "custom-admin-dashboard-container";
    container.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: #f8fafc; z-index: 9999999; display: flex;
        direction: rtl; font-family: "Cairo", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    `;

    container.innerHTML = `
        <div id="dash-main-wrapper" style="width: 100%; height: 100%; display: flex; background: #f8fafc; position: relative;">
            
            <div id="dash-sidebar-panel" style="${isMobile ? 'position: fixed; top: 0; right: 0; width: 260px; height: 100%; z-index: 100000; transition: right 0.3s ease; box-shadow: -5px 0 25px rgba(0,0,0,0.5);' : 'width: 260px; background: linear-gradient(180deg, #0b194f 0%, #060e2b 100%); color: #ffffff; display: flex; flex-direction: column; flex-shrink: 0; box-shadow: -4px 0 15px rgba(0,0,0,0.2); position: static;'} background: linear-gradient(180deg, #0b194f 0%, #060e2b 100%); color: #ffffff; display: flex; flex-direction: column;">
                
                <div style="padding: 22px 18px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 12px;">
                    <img src="1234.jpg" alt="Logo" style="width: 50px; height: 50px; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: bold;">لوحة تحكم الإدارة</h3>
                        <span style="font-size: 0.75rem; color: #94a3b8;">إدارة المنصة والاشتراكات</span>
                    </div>
                </div>

                <div style="padding: 15px 10px; overflow-y: auto; flex: 1;">
                    <div style="font-size: 0.75rem; color: #64748b; padding: 5px 15px; font-weight: bold;">القائمة الرئيسية</div>
                    <a href="javascript:void(0)" onclick="switchDashTab('users')" id="nav-users" class="dash-nav-item active" style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: #ffffff; text-decoration: none; border-radius: 8px; background: rgba(14, 165, 233, 0.25); border-right: 4px solid #0ea5e9; margin-bottom: 5px; font-weight: bold;"><i class="fas fa-users"></i> إدارة الحسابات والتفعيل</a>
                    
                    <div style="font-size: 0.75rem; color: #64748b; padding: 15px 15px 5px; font-weight: bold;">المالية والطلبات</div>
                    <a href="javascript:void(0)" onclick="switchDashTab('orders')" id="nav-orders" class="dash-nav-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: #cbd5e1; text-decoration: none; border-radius: 8px; margin-bottom: 5px;"><i class="fas fa-shopping-cart"></i> الطلبات وإيصالات الدفع</a>
                    <a href="javascript:void(0)" onclick="switchDashTab('reports')" id="nav-reports" class="dash-nav-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: #cbd5e1; text-decoration: none; border-radius: 8px; margin-bottom: 5px;"><i class="fas fa-wallet"></i> التقارير المالية</a>

                    <div style="font-size: 0.75rem; color: #64748b; padding: 15px 15px 5px; font-weight: bold;">التحليلات الأكاديمية</div>
                    <a href="javascript:void(0)" onclick="switchDashTab('analytics')" id="nav-analytics" class="dash-nav-item" style="display: flex; align-items: center; gap: 12px; padding: 12px 15px; color: #cbd5e1; text-decoration: none; border-radius: 8px; margin-bottom: 5px;"><i class="fas fa-chart-pie"></i> أداء الطلاب (Charts)</a>
                </div>

                <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button id="dash-close-full-btn" style="width: 100%; background: #ef4444; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fas fa-times"></i> إغلاق لوحة التحكم</button>
                </div>
            </div>

            <div style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: #f8fafc; width: 100%;">
                <div style="background: #ffffff; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button id="dash-sidebar-toggle-btn" style="${isMobile ? 'display: inline-flex;' : 'display: none;'} align-items: center; gap: 6px; background: #0b194f; color: white; border: none; padding: 10px 14px; border-radius: 8px; font-weight: bold; cursor: pointer;"><i class="fas fa-bars"></i> القائمة</button>
                        <div>
                            <h2 id="dash-header-title" style="margin: 0; color: #0f172a; font-size: 1.3rem; font-weight: bold;">إدارة الحسابات وطلبات تفعيل VIP</h2>
                            <span id="dash-header-subtitle" style="color: #64748b; font-size: 0.8rem;">مراجعة طلبات التفعيل، أمان الأجهزة، وإضافة أرقام مجانية</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button id="dash-refresh-btn" style="background: #e0f2fe; color: #0369a1; border: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;"><i class="fas fa-sync-alt"></i> تحديث</button>
                        <button id="dash-close-header-btn" style="background: #fee2e2; color: #991b1b; border: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer;"><i class="fas fa-times"></i> إغلاق</button>
                    </div>
                </div>

                <div id="dash-tab-content" style="padding: 20px; flex: 1;">
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    container.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('dash-sidebar-panel');
            const toggleBtn = document.getElementById('dash-sidebar-toggle-btn');
            if (sidebar && !sidebar.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
                sidebar.style.right = '-320px';
            }
        }
    });

    const toggleBtn = document.getElementById('dash-sidebar-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sidebar = document.getElementById('dash-sidebar-panel');
            if (sidebar) {
                sidebar.style.right = (sidebar.style.right === '0px' || !sidebar.style.right) ? '-320px' : '0px';
            }
        });
    }

    document.getElementById('dash-close-full-btn').addEventListener('click', () => {
        container.remove();
    });
    document.getElementById('dash-close-header-btn').addEventListener('click', () => {
        container.remove();
    });

    document.getElementById('dash-refresh-btn').addEventListener('click', () => {
        showToast("جاري تحديث البيانات...", "#0ea5e9");
        renderActiveDashTab();
    });

    currentActiveDashTab = "users";
    renderActiveDashTab();
}

window.switchDashTab = function(tabName) {
    currentActiveDashTab = tabName;
    document.querySelectorAll('.dash-nav-item').forEach(item => {
        item.style.background = "transparent";
        item.style.borderRight = "none";
        item.style.color = "#cbd5e1";
    });

    const activeNav = document.getElementById('nav-' + tabName);
    if (activeNav) {
        activeNav.style.background = "rgba(14, 165, 233, 0.25)";
        activeNav.style.borderRight = "4px solid #0ea5e9";
        activeNav.style.color = "#ffffff";
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('dash-sidebar-panel');
        if (sidebar) sidebar.style.right = '-320px';
    }

    renderActiveDashTab();
};

async function renderActiveDashTab() {
    const tabContent = document.getElementById('dash-tab-content');
    if (!tabContent) return;

    if (currentActiveDashTab === "users") {
        document.getElementById('dash-header-title').innerText = "إدارة الحسابات وطلبات تفعيل VIP";
        document.getElementById('dash-header-subtitle').innerText = "مراجعة طلبات التفعيل، أمان الأجهزة، وإضافة أرقام مجانية";
        
        tabContent.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; margin-bottom: 25px;">
                <div style="background: #ffffff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-right: 4px solid #0ea5e9; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.85rem; color: #64748b; font-weight: bold;">إجمالي الحسابات</div>
                        <div id="stat-total-users" style="font-size: 1.8rem; font-weight: bold; color: #0f172a; margin-top: 5px;">0</div>
                    </div>
                    <div style="width: 45px; height: 45px; background: #eff6ff; color: #0ea5e9; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;"><i class="fas fa-users"></i></div>
                </div>

                <div style="background: #ffffff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-right: 4px solid #f59e0b; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.85rem; color: #64748b; font-weight: bold;">طلبات تفعيل معلقة</div>
                        <div id="stat-pending-users" style="font-size: 1.8rem; font-weight: bold; color: #b45309; margin-top: 5px;">0</div>
                    </div>
                    <div style="width: 45px; height: 45px; background: #fef3c7; color: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;"><i class="fas fa-clock"></i></div>
                </div>

                <div style="background: #ffffff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border-right: 4px solid #10b981; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.85rem; color: #64748b; font-weight: bold;">حسابات VIP نشطة</div>
                        <div id="stat-active-users" style="font-size: 1.8rem; font-weight: bold; color: #065f46; margin-top: 5px;">0</div>
                    </div>
                    <div style="width: 45px; height: 45px; background: #d1fae5; color: #10b981; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;"><i class="fas fa-check-circle"></i></div>
                </div>
            </div>

            <div style="background: #ffffff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 25px; border: 2px solid #0ea5e9;">
                <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 1.1rem;"><i class="fas fa-user-plus" style="color: #0ea5e9;"></i> إضافة وتفعيل رقم VIP يدوياً (مجاناً):</h4>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                    <input type="tel" id="manual-add-phone" placeholder="أدخل رقم الموبايل (مثال: 010xxxxxxxx)" style="flex: 1; min-width: 220px; padding: 12px 15px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; direction: rtl; text-align: center; font-weight: bold;">
                    <input type="text" id="manual-add-duration" value="0 يوم" placeholder="المدة (مثال: 365 يوم، ما لا نهاية)..." style="width: 200px; padding: 12px 15px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; text-align: center;">
                    <button id="manual-add-btn" style="background: #0ea5e9; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i class="fas fa-plus-circle"></i> إضافة وتفعيل VIP</button>
                </div>
            </div>

            <div style="background: #ffffff; padding: 18px 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 20px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                <div style="flex: 1; min-width: 250px; position: relative;">
                    <input type="text" id="dash-search-input" placeholder="بحث برقم الموبايل أو اسم الحساب..." style="width: 100%; padding: 12px 15px 12px 40px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem;">
                    <i class="fas fa-search" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                </div>
                <select id="dash-filter-status" style="padding: 12px 18px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; min-width: 180px; font-weight: bold;">
                    <option value="ALL">كل حالات الحسابات</option>
                    <option value="Pending_Review">معلق (بانتظار التفعيل)</option>
                    <option value="VIP_Active">نشط (VIP Active)</option>
                    <option value="Expired">منتهي الصلاحية (Expired)</option>
                    <option value="Free">مجاني / غير نشط</option>
                </select>
            </div>

            <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: right; min-width: 850px;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #334155; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 15px 18px;">#</th>
                            <th style="padding: 15px 18px;">رقم الموبايل</th>
                            <th style="padding: 15px 18px;">الحالة الحالية</th>
                            <th style="padding: 15px 18px;">مدة التفعيل (كتابة يدوية)</th>
                            <th style="padding: 15px 18px;">أمان الجهاز</th>
                            <th style="padding: 15px 18px;">إجراءات الإدارة</th>
                        </tr>
                    </thead>
                    <tbody id="dash-table-body">
                        <tr>
                            <td colspan="6" style="padding: 40px; text-align: center; color: #64748b;">
                                <i class="fas fa-spinner fa-spin fa-2x"></i><br>جاري جلب قائمة الحسابات...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('dash-search-input').addEventListener('input', () => {
            loadDashboardTableData();
        });
        document.getElementById('dash-filter-status').addEventListener('change', () => {
            loadDashboardTableData();
        });

        document.getElementById('manual-add-btn').addEventListener('click', async () => {
            let phoneVal = document.getElementById('manual-add-phone').value.trim();
            let durationVal = document.getElementById('manual-add-duration').value.trim() || "0 يوم";
            
            if (phoneVal.length < 10) {
                showCustomAlert("برجاء إدخال رقم موبايل صحيح أولاً.", 'error');
                return;
            }

            let daysToAdd = 365;
            let isLifetime = false;
            if (durationVal.includes("ما لا نهاية") || durationVal.includes("دائم")) {
                daysToAdd = 36500;
                isLifetime = true;
            } else if (durationVal.includes("365") || durationVal.includes("سنة") || durationVal.includes("عام")) {
                daysToAdd = 365;
            } else if (durationVal.includes("6") || durationVal.includes("ست")) {
                daysToAdd = 180;
            } else if (durationVal.includes("شهر") || durationVal.includes("30")) {
                daysToAdd = 30;
            } else if (durationVal.includes("0") || durationVal.includes("صفر")) {
                daysToAdd = 0;
            }

            let endTimestamp = new Date(Date.now() + (daysToAdd * 24 * 60 * 60 * 1000));

            try {
                await db.collection("teachers").doc(phoneVal).set({
                    name: "VIP_Free_" + phoneVal,
                    phone: phoneVal,
                    status: "VIP_Active",
                    vipDurationText: durationVal,
                    subscriptionEnd: endTimestamp,
                    isLifetimeVIP: isLifetime,
                    role: "User",
                    subscriptionStart: new Date(),
                    addedManuallyByAdmin: true,
                    createdAt: new Date()
                }, { merge: true });

                showToast(`تم إضافة وتفعيل الرقم (${phoneVal}) في الـ VIP بنجاح!`);
                document.getElementById('manual-add-phone').value = "";
                document.getElementById('manual-add-duration').value = "0 يوم";
                loadDashboardTableData();
            } catch (e) {
                showCustomAlert("حدث خطأ أثناء الإضافة: " + e.message, 'error');
            }
        });

        loadDashboardTableData();
    }
    else if (currentActiveDashTab === "orders") {
        document.getElementById('dash-header-title').innerText = "الطلبات وإيصالات الدفع (بانتظار التفعيل)";
        document.getElementById('dash-header-subtitle').innerText = "جميع الأرقام التي حولت الفلوس ومنتظرة تفعيل العضوية";
        
        tabContent.innerHTML = `
            <div style="background: #ffffff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div>
                    <h4 style="margin: 0; color: #0f172a; font-size: 1.1rem;"><i class="fas fa-file-invoice-dollar" style="color:#b45309;"></i> قائمة طلبات الدفع المعلقة (Pending Activation):</h4>
                    <p style="margin: 5px 0 0 0; color: #64748b; font-size: 0.9rem;">يتم عرض الحسابات التي طلبت التفعيل (يرجى مطابقتها مع رسائل فودافون كاش)</p>
                </div>
                <button onclick="printOrdersReportPDF()" style="background: #10b981; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i class="fas fa-file-pdf"></i> تحميل تقرير الطلبات معلقة التفعيل (PDF)</button>
            </div>

            <div id="orders-report-print-area" style="background: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow-x: auto; padding: 10px;">
                <div style="text-align:center; padding: 15px; border-bottom: 2px solid #e2e8f0; margin-bottom: 10px;">
                    <h3 style="margin: 0; color: #0f172a;">تقرير طلبات الدفع وإيصالات التحويل </h3>
                    <span style="color: #64748b; font-size: 0.85rem;">تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; text-align: right; min-width: 600px;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #334155; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 14px 18px;">#</th>
                            <th style="padding: 14px 18px;">رقم الموبايل</th>
                            <th style="padding: 14px 18px;">إثبات الدفع</th>
                            <th style="padding: 14px 18px;">تاريخ الطلب</th>
                            <th style="padding: 14px 18px;">إجراء سريع</th>
                        </tr>
                    </thead>
                    <tbody id="orders-table-body">
                        <tr>
                            <td colspan="5" style="padding: 40px; text-align: center; color: #64748b;">
                                <i class="fas fa-spinner fa-spin fa-2x"></i><br>جاري جلب طلبات التفعيل المعلقة...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        loadOrdersTableData();
    }
    else if (currentActiveDashTab === "reports") {
        document.getElementById('dash-header-title').innerText = "التقارير المالية الشاملة";
        document.getElementById('dash-header-subtitle').innerText = "حساب إجمالي الدخل المالي وعدد المشتركين وطباعة التقرير كملف PDF";
        
        tabContent.innerHTML = `
            <div style="background: #ffffff; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div>
                    <h4 style="margin: 0; color: #0f172a; font-size: 1.1rem;"><i class="fas fa-coins" style="color:#059669;"></i> التقرير المالي لحسابات الـ VIP المدفوعة:</h4>
                    <p style="margin: 5px 0 0 0; color: #64748b; font-size: 0.9rem;">إجمالي العائد المحسوب بناءً على اشتراكات المشتركين النشطة (مع استبعاد الإدارة والعائلة)</p>
                </div>
                <button onclick="printFinancialReportPDF()" style="background: #0ea5e9; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i class="fas fa-file-pdf"></i> تحميل التقرير المالي الشامل (PDF)</button>
            </div>

            <div id="financial-report-print-area" style="background: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow-x: auto; padding: 20px;">
                <div style="text-align:center; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #0f172a;">التقرير المالي وإجمالي الدخل</h2>
                    <span style="color: #64748b; font-size: 0.9rem;">تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG')}</span>
                </div>

                <div style="display: flex; gap: 20px; margin-bottom: 25px; flex-wrap: wrap;">
                    <div style="flex: 1; background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 10px; text-align: center;">
                        <span style="color: #065f46; font-weight: bold; font-size: 0.95rem;">إجمالي العائد المالي المحسوب (جنيه)</span>
                        <div id="report-total-revenue" style="font-size: 2.2rem; font-weight: bold; color: #047857; margin-top: 10px;">0 ج.م</div>
                    </div>
                    <div style="flex: 1; background: #eff6ff; border: 1px solid #0ea5e9; padding: 20px; border-radius: 10px; text-align: center;">
                        <span style="color: #1e40af; font-weight: bold; font-size: 0.95rem;">عدد المشتركين الفعليين (VIP Active)</span>
                        <div id="report-active-subscribers" style="font-size: 2.2rem; font-weight: bold; color: #1d4ed8; margin-top: 10px;">0</div>
                    </div>
                </div>

                <h4 style="color: #0f172a; margin-bottom: 10px;">قائمة المشتركين النشطة التي دخلت في الحساب المالي:</h4>
                <table style="width: 100%; border-collapse: collapse; text-align: right; min-width: 600px;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #334155; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 12px 15px;">#</th>
                            <th style="padding: 12px 15px;">رقم الموبايل</th>
                            <th style="padding: 12px 15px;">المدة المشترك بها</th>
                            <th style="padding: 12px 15px;">القيمة المحسوبة</th>
                            <th style="padding: 12px 15px;">تاريخ التفعيل</th>
                        </tr>
                    </thead>
                    <tbody id="reports-table-body">
                        <tr>
                            <td colspan="5" style="padding: 40px; text-align: center; color: #64748b;">
                                <i class="fas fa-spinner fa-spin fa-2x"></i><br>جاري حساب الدخل المالي وتجهيز القائمة...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        loadFinancialReportData();
    }
    else if (currentActiveDashTab === "analytics") {
        document.getElementById('dash-header-title').innerText = "التحليلات الأكاديمية العميقة";
        document.getElementById('dash-header-subtitle').innerText = "مستويات الطلاب، نسب النجاح، والوقت المستغرق في الامتحانات التفاعلية";
        
        tabContent.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); text-align:center;">
                    <h4 style="color:#1e293b; margin-top:0;">متوسط درجات الطلاب (حسب المادة)</h4>
                    <canvas id="scoresChart" height="250"></canvas>
                </div>
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); text-align:center;">
                    <h4 style="color:#1e293b; margin-top:0;">معدل النجاح والرسوب العام</h4>
                    <canvas id="completionChart" height="250"></canvas>
                </div>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <h4 style="color:#1e293b; margin-top:0; border-bottom: 2px solid #e2e8f0; padding-bottom:10px;">سجل آخر امتحانات تفاعلية مسجلة</h4>
                <table style="width: 100%; border-collapse: collapse; text-align: right; min-width: 600px;">
                    <thead style="background:#f8fafc;">
                        <tr>
                            <th style="padding:12px; border-bottom: 2px solid #cbd5e1;">رقم الطالب</th>
                            <th style="padding:12px; border-bottom: 2px solid #cbd5e1;">المادة الدراسية</th>
                            <th style="padding:12px; border-bottom: 2px solid #cbd5e1;">النتيجة بالنسبة المئوية</th>
                            <th style="padding:12px; border-bottom: 2px solid #cbd5e1;">الوقت المستغرق</th>
                        </tr>
                    </thead>
                    <tbody id="analytics-table-body">
                        <tr><td colspan="4" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> جاري استدعاء التحليلات...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
        
        loadDeepAnalyticsData();
    }
}

async function loadDashboardTableData() {
    const tableBody = document.getElementById('dash-table-body');
    if (!tableBody) return;

    const searchTerm = (document.getElementById('dash-search-input')?.value || "").trim().toLowerCase();
    const filterStatus = document.getElementById('dash-filter-status')?.value || "ALL";

    try {
        const snapshot = await db.collection("teachers").get();
        let rowsHtml = "";
        let count = 0;
        let totalUsers = 0;
        let pendingUsers = 0;
        let activeUsers = 0;

        snapshot.forEach(doc => {
            totalUsers++;
            let data = doc.data();
            let phone = doc.id;
            let status = data.status || "Free";

            if (status === "VIP_Active" && data.subscriptionEnd && !data.isLifetimeVIP) {
                let endDate = data.subscriptionEnd.toDate ? data.subscriptionEnd.toDate().getTime() : new Date(data.subscriptionEnd).getTime();
                if (Date.now() > endDate && !AUTHORIZED_ADMIN_PHONES.includes(phone) && !MULTI_DEVICE_PHONES.includes(phone)) {
                    status = "Expired";
                }
            }

            if (status === "Pending_Review") pendingUsers++;
            if (status === "VIP_Active") activeUsers++;

            if (searchTerm && !phone.includes(searchTerm) && !(data.name || "").toLowerCase().includes(searchTerm)) return;
            if (filterStatus !== "ALL" && status !== filterStatus) return;

            count++;
            
            let statusBadge = "";
            if (AUTHORIZED_ADMIN_PHONES.includes(phone) || data.isLifetimeVIP || (data.vipDurationText && data.vipDurationText.includes("ما لا نهاية"))) {
                statusBadge = `<span style="background: #ecfdf5; color: #047857; border: 1px solid #059669; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-crown"></i> نشط VIP - ما لا نهاية</span>`;
            } else if (status === "VIP_Active") {
                statusBadge = `<span style="background: #d1fae5; color: #065f46; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">نشط VIP</span>`;
            } else if (status === "Pending_Review") {
                statusBadge = `<span style="background: #fef3c7; color: #b45309; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-clock"></i> معلق للمراجعة</span>`;
            } else if (status === "Expired") {
                statusBadge = `<span style="background: #fee2e2; color: #991b1b; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;"><i class="fas fa-exclamation-triangle"></i> منتهي (مغلق)</span>`;
            } else {
                statusBadge = `<span style="background: #f1f5f9; color: #475569; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">مجاني</span>`;
            }

            let deviceBadge = data.registeredDeviceFingerprint 
                ? `<span style="color: #059669; font-weight:bold; font-size:0.85rem;"><i class="fas fa-lock"></i> مرتبط بجهاز</span>`
                : `<span style="color: #94a3b8; font-size:0.85rem;">غير مرتبط</span>`;

            let currentDurationText = data.vipDurationText || "0 يوم";

            let isAdminRole = data.role === 'Admin' || AUTHORIZED_ADMIN_PHONES.includes(phone);
            let toggleAdminBtn = `<button onclick="toggleAdminAccess('${phone}', ${isAdminRole})" style="background: ${isAdminRole ? '#ef4444' : '#3b82f6'}; color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-left: 4px;" title="تفعيل/إلغاء لوحة التحكم"><i class="fas ${isAdminRole ? 'fa-user-times' : 'fa-user-shield'}"></i> ${isAdminRole ? 'إلغاء الإدارة' : 'ترقية لإدارة'}</button>`;

            rowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                    <td style="padding: 16px 18px; color: #64748b;">${count}</td>
                    <td style="padding: 16px 18px; font-family: monospace; font-size: 1.05rem; font-weight: bold; color: #0f172a;" dir="ltr">${phone}</td>
                    <td style="padding: 16px 18px;">${statusBadge}</td>
                    <td style="padding: 16px 18px;">
                        <input type="text" id="duration_${phone}" value="${currentDurationText}" placeholder="مثال: 365 يوم، ما لا نهاية..." style="width: 170px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem;">
                    </td>
                    <td style="padding: 16px 18px;">${deviceBadge}</td>
                    <td style="padding: 16px 18px; white-space: nowrap;">
                        <button onclick="manualActivateVIP('${phone}')" style="background: #10b981; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; margin-left: 4px;"><i class="fas fa-check"></i> تفعيل</button>
                        <button onclick="resetUserDevice('${phone}')" style="background: #f59e0b; color: white; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-left: 4px;" title="فك ارتباط الجهاز ليتمكن من الدخول بجهاز جديد"><i class="fas fa-mobile-alt"></i> فك الجهاز</button>
                        <button onclick="deactivateUserVIP('${phone}')" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-left: 4px;">إلغاء</button>
                        <button onclick="deleteUserAccount('${phone}')" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; margin-left: 4px;" title="حذف الحساب نهائياً"><i class="fas fa-trash"></i></button>
                        ${toggleAdminBtn}
                    </td>
                </tr>
            `;
        });

        if (document.getElementById('stat-total-users')) document.getElementById('stat-total-users').innerText = totalUsers;
        if (document.getElementById('stat-pending-users')) document.getElementById('stat-pending-users').innerText = pendingUsers;
        if (document.getElementById('stat-active-users')) document.getElementById('stat-active-users').innerText = activeUsers;

        if (count === 0) {
            rowsHtml = `<tr><td colspan="6" style="padding: 30px; text-align: center; color: #64748b;">لا توجد حسابات مطابقة للفلاتر الحالية.</td></tr>`;
        }

        tableBody.innerHTML = rowsHtml;
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="6" style="padding: 30px; text-align: center; color: red;">حدث خطأ أثناء جلب البيانات: ${e.message}</td></tr>`;
    }
}

async function loadOrdersTableData() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    try {
        const snapshot = await db.collection("teachers").where("status", "==", "Pending_Review").get();
        let rowsHtml = "";
        let count = 0;

        snapshot.forEach(doc => {
            count++;
            let data = doc.data();
            let phone = doc.id;
            
            let receiptHtml = `<span style="color: #b45309; font-weight: bold;"><i class="fas fa-mobile-alt"></i> راجع رسائل فودافون كاش</span>`;
            
            let uploadDate = data.paymentRequestedAt 
                ? new Date(data.paymentRequestedAt.seconds * 1000 || data.paymentRequestedAt).toLocaleDateString('ar-EG')
                : "---";

            rowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 14px 18px;">${count}</td>
                    <td style="padding: 14px 18px; font-weight: bold; font-family: monospace;" dir="ltr">${phone}</td>
                    <td style="padding: 14px 18px;">${receiptHtml}</td>
                    <td style="padding: 14px 18px; color:#64748b;">${uploadDate}</td>
                    <td style="padding: 14px 18px;">
                        <button onclick="manualActivateVIP('${phone}')" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">تفعيل VIP الفوري</button>
                    </td>
                </tr>
            `;
        });

        if (count === 0) {
            rowsHtml = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: #64748b;">لا توجد أي طلبات دفع معلقة في الوقت الحالي.</td></tr>`;
        }
        tableBody.innerHTML = rowsHtml;
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="5" style="padding: 30px; text-align: center; color: red;">خطأ في جلب الطلبات: ${e.message}</td></tr>`;
    }
}

async function loadFinancialReportData() {
    const tableBody = document.getElementById('reports-table-body');
    if (!tableBody) return;

    try {
        const snapshot = await db.collection("teachers").where("status", "==", "VIP_Active").get();
        let rowsHtml = "";
        let count = 0;
        let totalIncome = 0;

        snapshot.forEach(doc => {
            let phone = doc.id;
            let data = doc.data();
            
            let durationText = data.vipDurationText || "0 يوم";
            let amountCalculated = 50; 

            if (durationText.includes("مجاني") || 
                durationText.includes("ما لا نهاية") || 
                data.addedManuallyByAdmin || 
                data.isLifetimeVIP ||
                AUTHORIZED_ADMIN_PHONES.includes(phone) ||
                MULTI_DEVICE_PHONES.includes(phone)) {
                amountCalculated = 0;
            } else if (durationText.includes("365") || durationText.includes("سنة") || durationText.includes("عام")) {
                amountCalculated = 500;
            } else if (durationText.includes("6") || durationText.includes("ست")) {
                amountCalculated = 250;
            }

            totalIncome += amountCalculated;
            count++;

            let subDate = data.subscriptionStart 
                ? new Date(data.subscriptionStart.seconds * 1000 || data.subscriptionStart).toLocaleDateString('ar-EG') 
                : "---";

            rowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 15px;">${count}</td>
                    <td style="padding: 12px 15px; font-family: monospace; font-weight: bold;" dir="ltr">${phone}</td>
                    <td style="padding: 12px 15px;">${durationText}</td>
                    <td style="padding: 12px 15px; font-weight: bold; color: #047857;">${amountCalculated} ج.م</td>
                    <td style="padding: 12px 15px; color: #64748b;">${subDate}</td>
                </tr>
            `;
        });

        if (document.getElementById('report-total-revenue')) document.getElementById('report-total-revenue').innerText = totalIncome + " ج.م";
        if (document.getElementById('report-active-subscribers')) document.getElementById('report-active-subscribers').innerText = count;

        if (count === 0) {
            rowsHtml = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: #64748b;">لا توجد حسابات VIP نشطة حتى الآن.</td></tr>`;
        }
        tableBody.innerHTML = rowsHtml;
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="5" style="padding: 30px; text-align: center; color: red;">خطأ في إعداد التقرير المالي: ${e.message}</td></tr>`;
    }
}

async function loadDeepAnalyticsData() {
    try {
        const snapshot = await db.collection("exam_analytics").orderBy("timestamp", "desc").limit(50).get();
        let tableHtml = "";
        
        let gradeScores = {}; 
        let passed = 0; let failed = 0;

        snapshot.forEach(doc => {
            let data = doc.data();
            let phone = data.studentId || "غير معروف";
            let subject = data.subject || "غير محدد";
            let score = data.score || 0;
            let total = data.totalQuestions || 1;
            let timeUsed = data.timeUsedSec || 0;
            
            let percentage = Math.round((score / total) * 100);
            
            if (percentage >= 50) passed++; else failed++;
            
            if (!gradeScores[subject]) gradeScores[subject] = [];
            gradeScores[subject].push(percentage);

            let timeStr = `${Math.floor(timeUsed / 60)} دقيقة و ${timeUsed % 60} ثانية`;
            let color = percentage >= 85 ? "#10b981" : (percentage >= 50 ? "#f59e0b" : "#ef4444");

            tableHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding:12px; font-weight:bold;" dir="ltr">${phone}</td>
                    <td style="padding:12px;">${subject}</td>
                    <td style="padding:12px; font-weight:bold; color:${color};">${score} / ${total} (${percentage}%)</td>
                    <td style="padding:12px; color:#64748b;">${timeStr}</td>
                </tr>
            `;
        });

        if (snapshot.empty) {
            tableHtml = `<tr><td colspan="4" style="text-align:center; padding:20px;">لا توجد بيانات امتحانات مسجلة بعد.</td></tr>`;
        }
        
        document.getElementById('analytics-table-body').innerHTML = tableHtml;

        if (!snapshot.empty && typeof Chart !== 'undefined') {
            let labels = Object.keys(gradeScores);
            let averages = labels.map(subj => {
                let sum = gradeScores[subj].reduce((a, b) => a + b, 0);
                return Math.round(sum / gradeScores[subj].length);
            });

            new Chart(document.getElementById('scoresChart'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'متوسط درجات الطلاب (%)',
                        data: averages,
                        backgroundColor: '#0ea5e9',
                        borderRadius: 6
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });

            new Chart(document.getElementById('completionChart'), {
                type: 'doughnut',
                data: {
                    labels: ['ناجح (فوق 50%)', 'راسب (أقل من 50%)'],
                    datasets: [{
                        data: [passed, failed],
                        backgroundColor: ['#10b981', '#ef4444']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        
    } catch (e) {
        document.getElementById('analytics-table-body').innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">خطأ: ${e.message}</td></tr>`;
    }
}

window.printOrdersReportPDF = function() {
    const elementToPrint = document.getElementById('orders-report-print-area');
    if (!elementToPrint) return;

    showToast("جاري تجهيز تقرير الطلبات PDF...");
    const opt = {
        margin: 0.5,
        filename: 'Pending_Orders_' + Date.now() + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: false, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(elementToPrint).save();
};

window.printFinancialReportPDF = function() {
    const elementToPrint = document.getElementById('financial-report-print-area');
    if (!elementToPrint) return;

    showToast("جاري تجهيز التقرير المالي الشامل PDF...");
    const opt = {
        margin: 0.5,
        filename: 'Financial_Report_' + Date.now() + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: false, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(elementToPrint).save();
};

window.manualActivateVIP = async function(phone) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    
    let durationInput = document.getElementById(`duration_${phone}`);
    let customDurationText = durationInput ? durationInput.value.trim() : "0 يوم";
    if (!customDurationText) customDurationText = "0 يوم";

    let daysToAdd = 365;
    let isLifetime = false;
    if (customDurationText.includes("ما لا نهاية") || customDurationText.includes("دائم")) {
        daysToAdd = 36500;
        isLifetime = true;
    } else if (customDurationText.includes("365") || customDurationText.includes("سنة") || customDurationText.includes("عام")) {
        daysToAdd = 365;
    } else if (customDurationText.includes("6") || customDurationText.includes("ست")) {
        daysToAdd = 180;
    } else if (customDurationText.includes("3") || customDurationText.includes("تلات")) {
        daysToAdd = 90;
    } else if (customDurationText.includes("شهر") || customDurationText.includes("30")) {
        daysToAdd = 30;
    } else if (customDurationText.includes("0") || customDurationText.includes("صفر")) {
        daysToAdd = 0;
    }

    let endTimestamp = new Date(Date.now() + (daysToAdd * 24 * 60 * 60 * 1000));

    try {
        await db.collection("teachers").doc(phone).update({
            status: "VIP_Active",
            vipDurationText: customDurationText,
            subscriptionStart: new Date(),
            subscriptionEnd: endTimestamp,
            isLifetimeVIP: isLifetime,
            lastUpdatedByAdmin: new Date()
        });
        showToast(`تم تفعيل حساب ${phone} بنجاح لمدة (${customDurationText})`);
        renderActiveDashTab();
    } catch (e) {
        showCustomAlert("خطأ أثناء التفعيل اليدوي: " + e.message, 'error');
    }
};

window.resetUserDevice = function(phone) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    showCustomConfirm(`هل تريد فعلاً فك ارتباط جهاز الطالب (${phone}) ليتمكن من الدخول بهاتف جديد؟`, async (isYes) => {
        if(!isYes) return;
        try {
            await db.collection("teachers").doc(phone).update({
                registeredDeviceFingerprint: null
            });
            showToast(`تم فك ارتباط الجهاز للحساب (${phone}) بنجاح!`, "#f59e0b");
            renderActiveDashTab();
        } catch (e) {
            showCustomAlert("خطأ: " + e.message, 'error');
        }
    });
};

window.deactivateUserVIP = function(phone) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    showCustomConfirm(`هل أنت متأكد من قفل وإلغاء تفعيل حساب الطالب (${phone})؟`, async (isYes) => {
        if(!isYes) return;
        try {
            await db.collection("teachers").doc(phone).update({
                status: "Expired",
                isLifetimeVIP: false,
                lastUpdatedByAdmin: new Date()
            });
            showToast(`تم قفل وإلغاء تفعيل الحساب: ${phone}`, "#ef4444");
            renderActiveDashTab();
        } catch (e) {
            showCustomAlert("خطأ: " + e.message, 'error');
        }
    });
};

window.deleteUserAccount = function(phone) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    showCustomConfirm(`هل أنت متأكد من حذف الحساب رقم (${phone}) نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذه الخطوة.`, async (isYes) => {
        if(!isYes) return;
        try {
            await db.collection("teachers").doc(phone).delete();
            showToast(`تم حذف الحساب (${phone}) نهائياً بنجاح!`, "#ef4444");
            renderActiveDashTab();
        } catch (e) {
            showCustomAlert("خطأ أثناء الحذف: " + e.message, 'error');
        }
    });
};

window.toggleAdminAccess = function(phone, isCurrentlyAdmin) {
    if (!AUTHORIZED_ADMIN_PHONES.includes(currentTeacherId) && currentUserRole !== 'Admin') return;
    
    let newRole = isCurrentlyAdmin ? 'User' : 'Admin';
    let confirmMsg = isCurrentlyAdmin ? `هل أنت متأكد من سحب صلاحيات لوحة التحكم من الرقم (${phone}) وإرجاعه كطالب عادي؟` : `هل أنت متأكد من منح صلاحيات الإدارة للرقم (${phone})؟ (سيتم تعيين الباسورد الافتراضي 1234)`;
    
    showCustomConfirm(confirmMsg, async (isYes) => {
        if(!isYes) return;
        try {
            let updates = { role: newRole };
            if (newRole === 'Admin') {
                updates.adminPassword = '1234'; 
                updates.status = 'VIP_Active';
            }
            await db.collection("teachers").doc(phone).update(updates);
            showToast(`تم تعديل صلاحيات الرقم (${phone}) إلى ${newRole === 'Admin' ? 'مدير' : 'طالب'} بنجاح!`, "#10b981");
            renderActiveDashTab();
        } catch (e) {
            showCustomAlert("خطأ: " + e.message, 'error');
        }
    });
};

// ============================================================================
// 6. نظام المحاولات المجانية للزوار
// ============================================================================
function checkAttempts() {
    let attempts = parseInt(localStorage.getItem('user_attempts') || 0);
    if (attempts >= 3) {
        showCustomAlert("انتهت محاولاتك المجانية. يرجى تسجيل الدخول والاشتراك في الـ VIP للمتابعة.", 'error');
        showAuthScreen();
        
        document.getElementById('auth-user-card').style.display = 'none';
        document.getElementById('auth-payment-card').style.display = 'block';
        return false;
    }
    return true;
}

function incrementAttempt() {
    let attempts = parseInt(localStorage.getItem('user_attempts') || 0) + 1;
    localStorage.setItem('user_attempts', attempts);
}

// ============================================================================
// 7. تحميل الصفحة والأحداث
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    
    createAuthScreen();

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
        high_general_sci_biology: ["اللغة العربية", "اللغة الإنجليزية", "الفيزياء", "الكيمياء", "الأحياء", "الجيولوجيا", "اللغة الأجنبية الثانية"],
        high_general_sci_math: ["اللغة العربية", "اللغة الإنجليزية", "الفيزياء", "الكيمياء", "الرياضيات البحتة", "الرياضيات التطبيقية", "اللغة الأجنبية الثانية"],
        high_general_lit: ["اللغة العربية", "اللغة الإنجليزية", "التاريخ", "الجغرافيا", "علم النفس", "الفلسفة والمنطق", "اللغة الأجنبية الثانية"],
        high_azhar_sci: ["القرآن الكريم", "الفقه", "الحديث", "النحو", "الصرف", "الفيزياء", "الكيمياء", "الأحياء", "الرياضيات", "اللغة الإنجليزية"],
        high_azhar_lit: ["القرآن الكريم", "الفقه", "الحديث", "النحو", "الصرف", "التاريخ", "الجغرافيا", "المنطق", "اللغة الإنجليزية"],
        diploma_industrial: ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "الفيزياء العامة", "تخصصات صناعية متعددة"],
        diploma_commercial: ["اللغة العربية", "اللغة الإنجليزية", "إدارة أعمال", "محاسبة مالية", "سكرتارية", "اقتصاد وإحصاء"],
        diploma_agricultural: ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "محاصيل الحقل", "أمراض النبات", "صناعات زراعية"],
        diploma_tourism: ["اللغة العربية", "اللغة الإنجليزية", "أصول فن الطهو", "خدمة المطاعم", "شركات السياحة", "محاسبة فندقية"]
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
        ui.searchInput.setAttribute('autocomplete', 'off');
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
                let summaryIdStr = subject + '_' + yearText;
                const summaryDocId = summaryIdStr.replace(/\s+/g, '_');
                
                const styleRef = db.collection("teacher_styles").doc(summaryDocId);
                const styleSnap = await styleRef.get();
                
                if (styleSnap.exists) {
                    let sData = styleSnap.data();
                    let sTime = sData.createdAt.toDate ? sData.createdAt.toDate().getTime() : sData.createdAt;
                    
                    if (Date.now() - sTime > (6 * 30 * 24 * 60 * 60 * 1000)) {
                        await styleRef.delete(); 
                        globalTeacherStyle = "";
                    } else {
                        globalTeacherStyle = sData.styleText;
                    }
                } else {
                    globalTeacherStyle = "";
                }

                const newImageHash = await generateFileHash(selectedLessonFiles[0]) + "_" + selectedLessonFiles.length;
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

                let aiPrompt = `MANDATORY_STRICT_INSTRUCTION: YOU ARE THE CHIEF EXAM CREATOR FOR THE EGYPTIAN MINISTRY OF EDUCATION (2026). YOU MUST GENERATE CONTENT THAT EXACTLY MATCHES THE EGYPTIAN NATIONAL CURRICULUM EXAM STANDARDS FOR "${yearText}" IN SUBJECT "${subject}".
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
                        'Content-Type': 'application/json' 
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
                
                if (!isVIPLoggedIn) {
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
        
        document.getElementById('native-print-btn').addEventListener('click', () => {
            preparePDFDOM(serverData, subjectName);
            window.print();
        });
        
        document.getElementById('ai-output-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function preparePDFDOM(serverData, subjectName) {
        const selectedFormat = document.getElementById('study-material-format')?.value || 'pdf-qa';
        const isExamMode = (selectedFormat === 'exam-focus');
        const isSummaryMode = (selectedFormat === 'summary');

        let qaHtml = '';
        let questionCount = 0;
        
        serverData.qa_data.forEach((item, index) => {
            questionCount++;
            let cleanQuestion = stripParentheses(item.q);
            
            let typeTitle = "";
            if (!isSummaryMode) {
                if (item.type === "MCQ") typeTitle = " [اختيار من متعدد]";
                else if (item.type === "TF") typeTitle = " [صح أو خطأ]";
                else if (item.type === "ESSAY") typeTitle = " [سؤال مقالي]";
            }

            qaHtml += '<div class="pdf-question-block" style="margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border-right: 4px solid #10b981; direction: rtl; text-align: right; position: relative; z-index: 1; page-break-inside: avoid !important; break-inside: avoid !important;">';
            
            if (isSummaryMode) {
                qaHtml += '<p style="color: #0f172a; margin: 0 0 12px 0; font-size: 16px; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;"><strong><i class="fas fa-star" style="color:#f59e0b;"></i> ' + cleanQuestion + '</strong></p>';
                qaHtml += '<div style="margin: 10px 0 0 0; line-height: 1.9; font-size: 15px; color: #1e293b;">' + (item.a ? item.a.replace(/\n/g, '<br>') : '') + '</div>';
                if (item.reason) {
                    qaHtml += '<div style="margin: 10px 0 0 0; line-height: 1.9; font-size: 14px; color: #059669; font-weight: bold;">' + item.reason.replace(/\n/g, '<br>') + '</div>';
                }
            } else {
                qaHtml += '<p style="color: #0f172a; margin: 0 0 8px 0; font-size: 15px;"><strong>س ' + questionCount + ': ' + cleanQuestion + typeTitle + '</strong></p>';
                
                if (item.options && Array.isArray(item.options) && item.options.length > 0) {
                    qaHtml += '<div style="margin: 10px 0; padding: 10px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1;">';
                    item.options.forEach((opt) => {
                        let cleanOpt = stripParentheses(opt);
                        let isThisCorrect = (!isExamMode && item.a && (item.a.includes(cleanOpt) || cleanOpt.includes(item.a)));
                        let mark = isThisCorrect ? " <strong style='color:#059669;'>(✓ الإجابة الصحيحة)</strong>" : "";
                        qaHtml += '<div style="margin-bottom: 6px; color: #1e293b; font-size: 14px;">• ' + cleanOpt + mark + '</div>';
                    });
                    qaHtml += '</div>';
                }

                if (!isExamMode) {
                    if (item.type === "TF") {
                        let isTrueAns = (item.a && (item.a.includes("صح") || item.a.includes("true") || item.a.includes("✓")));
                        let symbolMark = isTrueAns ? "[ ✓ ]" : "[ ✕ ]";
                        let colorMark = isTrueAns ? "#059669" : "#b45309";
                        qaHtml += `<p style="margin: 10px 0 0 0; font-size: 14px; font-weight: bold; color: ${colorMark};">${symbolMark}</p>`;
                        if (item.reason) {
                            qaHtml += '<p style="margin: 6px 0 0 0; line-height: 1.8; font-size: 13px; color: #334155;"><strong>السبب العلمي:</strong><br>' + item.reason.replace(/\n/g, '<br>') + '</p>';
                        }
                    } else {
                        qaHtml += '<p style="margin: 10px 0 0 0; line-height: 1.8; font-size: 13px; color: #059669;"><strong>الإجابة النموذجية: </strong><br>' + item.a.replace(/\n/g, '<br>') + '</p>';
                        if (item.reason) {
                            qaHtml += '<p style="margin: 8px 0 0 0; line-height: 1.8; font-size: 13px; color: #b45309;"><strong>السبب والتفسير العلمي الوافي:</strong><br>' + item.reason.replace(/\n/g, '<br>') + '</p>';
                        }
                    }
                } else {
                    qaHtml += '<div style="margin-top: 15px; border-bottom: 1px dashed #cbd5e1; height: 25px;"></div>';
                }
            }
            
            qaHtml += '</div>';
        });

        document.getElementById('pdf-qa-content').innerHTML = qaHtml;
        document.getElementById('pdf-header-title').innerText = (isSummaryMode ? 'مذكرة ملخص | ' : 'ملف أسئلة | ') + stripParentheses(serverData.subjectTitle || subjectName) + ' | ' + stripParentheses(serverData.grade || "");
        
        let pdfCreationDate = new Date(serverData.lastUpdated || Date.now()).toLocaleDateString('ar-EG');
        let footerElement = document.querySelector('#pdf-template > div > div:last-child');
        
        if (footerElement) {
            footerElement.innerHTML = 'تاريخ الإنشاء: ' + pdfCreationDate + (isSummaryMode ? ' | عدد الأقسام المستخرجة: ' : ' | عدد الأسئلة المستخرجة: ') + questionCount + '<br>تم التوليد بواسطة منصة الذكاء الاصطناعي 2026';
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
                    // التعديل الأول: ربط التصحيح بالمسار الجديد في Python المسمى semantic_grade لتسريع الاستجابة
                    try {
                        const response = await fetch('/api/analyze', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
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

    // ============================================================================
    // نظام "المعلم التفاعلي" الأصلي والغامر
    // ============================================================================
    const tutorFabBtn = document.getElementById('tutor-fab-btn');
    const tutorImmersiveModal = document.getElementById('tutor-immersive-modal');
    const closeImmersiveBtn = document.getElementById('close-immersive-btn');
    const immersiveInput = document.getElementById('tutor-immersive-input');
    const immersiveSendBtn = document.getElementById('tutor-immersive-send-btn');
    const immersiveMessagesArea = document.getElementById('tutor-immersive-messages');

    if (tutorFabBtn && tutorImmersiveModal) {
        tutorFabBtn.onclick = (e) => {
            e.preventDefault();
            tutorImmersiveModal.classList.remove('hidden-section');
            tutorImmersiveModal.classList.add('active');
            
            // التعديل الثاني: استدعاء دالة بناء الـ 3D عند فتح النافذة
            init3DRobot();
        };
    }

    if (closeImmersiveBtn) {
        closeImmersiveBtn.addEventListener('click', () => {
            tutorImmersiveModal.classList.remove('active');
            setTimeout(() => tutorImmersiveModal.classList.add('hidden-section'), 400);
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
        if (!text) return;
        
        appendImmersiveMessage(text, 'user');
        immersiveInput.value = '';

        const typingId = 'imm-typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'tutor-msg bot-msg';
        typingDiv.innerHTML = '<i class="fas fa-ellipsis-h fa-fade"></i> جاري التفكير...';
        immersiveMessagesArea.appendChild(typingDiv);
        immersiveMessagesArea.scrollTop = immersiveMessagesArea.scrollHeight;

        let currentYear = document.getElementById('year-stage')?.options[document.getElementById('year-stage')?.selectedIndex]?.text || "غير محدد";
        let mainStageVal = document.getElementById('main-stage')?.value || "";
        
        let customPrompt = "MANDATORY_STRICT_INSTRUCTION: YOU ARE A FRIENDLY, HUMAN-LIKE EXPERT EGYPTIAN TEACHER. ";
        customPrompt += "CRITICAL RULE 1: YOU MUST STRICTLY ADHERE TO THE UPLOADED LESSON CONTENT ONLY. NEVER ADD EXTERNAL INFORMATION OUTSIDE THE UPLOADED IMAGES OR CURRICULUM. ";
        customPrompt += "CRITICAL RULE 2: IF THE SUBJECT IS ENGLISH, FRENCH, GERMAN, OR ITALIAN, YOU MUST EXPLAIN IN THAT SPECIFIC LANGUAGE FIRST. HOWEVER, IF THE STUDENT DOES NOT UNDERSTAND OR ASKS TO EXPLAIN IN ARABIC, YOU MUST EXPLAIN IN CLEAR ARABIC. FOR ALL OTHER SUBJECTS, SPEAK ARABIC BY DEFAULT. ";
        
        if (mainStageVal.includes('primary')) {
            customPrompt += "THE STUDENT IS IN PRIMARY SCHOOL (" + currentYear + "). EXPLAIN IN A VERY SIMPLE, CLEAR, AND ENGAGING WAY SUITABLE FOR CHILDREN.";
        } else if (mainStageVal.includes('prep')) {
            customPrompt += "THE STUDENT IS IN PREPARATORY SCHOOL (" + currentYear + "). EXPLAIN SIMPLY BUT PROVIDE A COMPREHENSIVE AND STRUCTURED EXPLANATION FOR THE QUESTION.";
        } else if (mainStageVal.includes('high') || mainStageVal.includes('diploma')) {
            customPrompt += "THE STUDENT IS IN SECONDARY SCHOOL/DIPLOMA (" + currentYear + "). EXPLAIN USING ALL AVAILABLE METHODS, PROVIDE DEEP ACADEMIC ANALYSIS, EXAMPLES, AND THOROUGH DETAILS.";
        } else {
            customPrompt += "ADAPT YOUR EXPLANATION TO THE STUDENT'S LEVEL.";
        }

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    message: text,
                    context: globalLessonContext,
                    strict_prompt_command: customPrompt
                })
            });

            if (!response.ok) throw new Error("Server error");
            const data = await response.json();
            
            document.getElementById(typingId).remove();
            let finalReply = data.answer || data.reply || data.message || "لا يوجد رد متاح.";
            appendImmersiveMessage(finalReply, 'bot');
            
        } catch (err) {
            if(document.getElementById(typingId)) document.getElementById(typingId).remove();
            appendImmersiveMessage("عذراً، حدث خطأ في الاتصال. 🤖", 'bot');
        }
    }

    if (immersiveSendBtn && immersiveInput) {
        immersiveSendBtn.addEventListener('click', sendImmersiveQuestion);
        immersiveInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendImmersiveQuestion();
        });
    }

    // ============================================================================
    // دالة بناء وتفعيل المعلم ثلاثي الأبعاد (Three.js 3D Robot)
    // ============================================================================
    function init3DRobot() {
        const container = document.getElementById('tutor-3d-canvas-container');
        if (!container || typeof THREE === 'undefined') return;
        
        // التحقق من عدم التكرار إذا كان قد تم بناؤه مسبقاً
        if (container.innerHTML.includes('canvas')) return;
        container.innerHTML = ''; 

        // إعداد المشهد الأساسي
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // إضافة الإضاءة
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        scene.add(directionalLight);

        // بناء رأس الروبوت
        const headGeometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.3, metalness: 0.8 });
        const robotHead = new THREE.Mesh(headGeometry, headMaterial);
        
        // بناء عيون الروبوت
        const eyeGeo = new THREE.SphereGeometry(0.3, 32, 32);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.6, 0.3, 1.25);
        
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.6, 0.3, 1.25);
        
        // بناء هوائي فوق الرأس (Antenna)
        const antennaGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 32);
        const antennaMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.set(0, 1.7, 0);
        
        const antennaBulbGeo = new THREE.SphereGeometry(0.2, 32, 32);
        const antennaBulbMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const antennaBulb = new THREE.Mesh(antennaBulbGeo, antennaBulbMat);
        antennaBulb.position.set(0, 2.2, 0);

        // تجميع الروبوت
        robotHead.add(leftEye);
        robotHead.add(rightEye);
        robotHead.add(antenna);
        robotHead.add(antennaBulb);
        scene.add(robotHead);

        camera.position.z = 6;

        // حركة الروبوت (Float & Rotate)
        function animate() {
            requestAnimationFrame(animate);
            
            // دوران خفيف حول المحور
            robotHead.rotation.y = Math.sin(Date.now() * 0.001) * 0.3;
            // طفو لأعلى ولأسفل
            robotHead.position.y = Math.sin(Date.now() * 0.002) * 0.3;
            
            renderer.render(scene, camera);
        }
        animate();

        // تحديث الأبعاد عند تصغير/تكبير الشاشة
        window.addEventListener('resize', () => {
            if (container.clientWidth > 0 && container.clientHeight > 0) {
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });
    }

}); // نهاية المستند
