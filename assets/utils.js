// utils.js - Các hàm tiện ích dùng chung
import { db, auth, onAuthStateChanged } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Xử lý đóng/mở menu người dùng - sử dụng ở nhiều trang
export function setupMenuToggle() {
    document.getElementById("menuBtn")?.addEventListener("click", () => {
        const menu = document.getElementById("userMenu");
        menu.classList.toggle("hidden");
    });

    // Ẩn menu khi click bên ngoài
    document.addEventListener("click", (event) => {
        const menu = document.getElementById("userMenu");
        const menuBtn = document.getElementById("menuBtn");
        
        if (menu && !menu.classList.contains("hidden") && 
            !menu.contains(event.target) && 
            !menuBtn?.contains(event.target)) {
            menu.classList.add("hidden");
        }
    });
}

// Kiểm tra người dùng có phải là admin hoặc giáo viên không
export async function isAdminOrTeacher() {
    const user = auth.currentUser;
    if (!user) return false;
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return false;
        
        const role = userDoc.data().role;
        return role === "admin" || role === "teacher";
    } catch (error) {
        console.error("Lỗi khi kiểm tra quyền:", error);
        return false;
    }
}

// Kiểm tra người dùng có phải admin và hiển thị liên kết admin
export async function checkAdminRole() {
    const user = auth.currentUser;
    if (!user) return false;
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const isAdmin = userDoc.exists() && userDoc.data().role === "admin";
        
        // Cập nhật giao diện nếu phần tử tồn tại
        if (isAdmin) {
            const adminLink = document.getElementById("adminLink");
            if (adminLink) adminLink.classList.remove("hidden");
        }
        
        return isAdmin;
    } catch (error) {
        console.error("Lỗi khi kiểm tra quyền admin:", error);
        return false;
    }
}

// Lấy vai trò người dùng
export async function getUserRole(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId || auth.currentUser?.uid));
        return userDoc.exists() ? userDoc.data().role : "student";
    } catch (error) {
        console.error("Lỗi khi lấy vai trò người dùng:", error);
        return "student";
    }
}

// Lấy tên lớp học theo ID
export async function getClassName(classId) {
    if (!classId) return "Không thuộc lớp";
    try {
        const classDoc = await getDoc(doc(db, "classes", classId));
        return classDoc.exists() ? classDoc.data().name : "Lớp không xác định";
    } catch (error) {
        console.error("Lỗi khi lấy tên lớp:", error);
        return "Lỗi";
    }
}

// Chờ xác thực sẵn sàng
export function waitForAuth() {
    return new Promise(resolve => {
        if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
        }
        
        const unsubscribe = onAuthStateChanged(auth, user => {
            unsubscribe();
            resolve(user);
        });
    });
}

// Lấy danh sách lớp học của người dùng
export async function getUserClasses(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId || auth.currentUser?.uid));
        return userDoc.exists() && userDoc.data().classIds ? userDoc.data().classIds : [];
    } catch (error) {
        console.error("Lỗi khi lấy danh sách lớp học của người dùng:", error);
        return [];
    }
}

// Kiểm tra người dùng có phải là thành viên của lớp học
export async function isClassMember(classId) {
    const user = auth.currentUser;
    if (!user) return false;
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return false;
        
        const userData = userDoc.data();
        return userData.classIds && userData.classIds.includes(classId);
    } catch (error) {
        console.error("Lỗi khi kiểm tra tư cách thành viên lớp học:", error);
        return false;
    }
}

// Hiển thị trạng thái đang tải
export function showLoading(element, message = "Đang tải dữ liệu...") {
    if (!element) return;
    
    element.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block">
                <i class="fas fa-spinner fa-pulse text-blue-500 text-3xl mb-3"></i>
                <p class="text-gray-600">${message}</p>
            </div>
        </div>
    `;
}

// Hiển thị thông báo lỗi
export function showError(element, message = "Lỗi khi tải dữ liệu!") {
    if (!element) return;
    
    element.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block">
                <i class="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
                <p class="text-red-500">${message}</p>
            </div>
        </div>
    `;
}

// Hiển thị thông báo trống dữ liệu
export function showEmpty(element, message = "Không có dữ liệu nào.") {
    if (!element) return;
    
    element.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block">
                <i class="fas fa-info-circle text-blue-500 text-3xl mb-3"></i>
                <p class="text-gray-600">${message}</p>
            </div>
        </div>
    `;
}
