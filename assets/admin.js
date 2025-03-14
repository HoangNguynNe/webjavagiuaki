// admin.js - Quản lý quản trị viên
import { db, auth, onAuthStateChanged } from "./firebase.js";
import { 
    collection, getDocs, updateDoc, doc, deleteDoc, query, where, getDoc, orderBy, limit 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
    setupMenuToggle, waitForAuth, getClassName, showLoading, showError, showEmpty
} from "./utils.js";

// Khởi tạo chức năng menu
setupMenuToggle();

// Kiểm tra quyền admin
async function checkAdminAccess() {
    try {
        const user = await waitForAuth();
        
        if (!user) {
            alert("Bạn cần đăng nhập!");
            window.location.href = "index.html";
            return false;
        }

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== "admin") {
            alert("Bạn không có quyền truy cập trang này!");
            window.location.href = "dashboard.html";
            return false;
        }
        return true;
    } catch (error) {
        console.error("Lỗi khi kiểm tra quyền admin:", error);
        alert("Có lỗi xảy ra khi kiểm tra quyền truy cập!");
        return false;
    }
}

// Load thống kê số lượng người dùng
async function loadUserStats() {
    if (!await checkAdminAccess()) return;
    
    try {
        // Tổng số thành viên (không tính trạng thái chờ)
        const membersQuery = query(collection(db, "users"), where("role", "!=", "pending"));
        const membersSnapshot = await getDocs(membersQuery);
        document.getElementById("totalMembersCount").textContent = membersSnapshot.size;
        
        // Thành viên đang chờ duyệt
        const pendingQuery = query(collection(db, "users"), where("role", "==", "pending"));
        const pendingSnapshot = await getDocs(pendingQuery);
        document.getElementById("pendingMembersCount").textContent = pendingSnapshot.size;
        
        // Giáo viên
        const teachersQuery = query(collection(db, "users"), where("role", "==", "teacher"));
        const teachersSnapshot = await getDocs(teachersQuery);
        document.getElementById("teachersCount").textContent = teachersSnapshot.size;
        
        // Quản trị viên
        const adminsQuery = query(collection(db, "users"), where("role", "==", "admin"));
        const adminsSnapshot = await getDocs(adminsQuery);
        document.getElementById("adminsCount").textContent = adminsSnapshot.size;
    } catch (error) {
        console.error("Lỗi khi tải thống kê người dùng:", error);
    }
}

// Tải bài đăng gần đây
async function loadRecentPosts() {
    if (!await checkAdminAccess()) return;
    
    const recentPostsContainer = document.getElementById("adminRecentPosts");
    if (!recentPostsContainer) return;
    
    showLoading(recentPostsContainer, "Đang tải bài đăng gần đây...");
    
    try {
        const postsQuery = query(
            collection(db, "posts"),
            orderBy("createdAt", "desc"),
            limit(5)
        );
        
        const querySnapshot = await getDocs(postsQuery);
        
        if (querySnapshot.empty) {
            showEmpty(recentPostsContainer, "Chưa có bài đăng nào trong hệ thống.");
            return;
        }
        
        recentPostsContainer.innerHTML = "";
        
        querySnapshot.forEach((docSnap) => {
            const postData = docSnap.data();
            const date = new Date(postData.createdAt).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            const postHtml = `
                <div class="border-b pb-2 mb-2 last:border-0">
                    <h4 class="font-semibold">${postData.title}</h4>
                    <p class="text-sm text-gray-600 line-clamp-2">${postData.content}</p>
                    <div class="flex justify-between items-center mt-1 text-xs text-gray-500">
                        <span>${postData.authorName || 'Người dùng'}</span>
                        <span>${date}</span>
                    </div>
                </div>
            `;
            
            recentPostsContainer.innerHTML += postHtml;
        });
    } catch (error) {
        console.error("Lỗi khi tải bài đăng gần đây:", error);
        showError(recentPostsContainer, "Lỗi khi tải dữ liệu bài đăng.");
    }
}

// Tải danh sách lớp học
async function loadClassesList() {
    if (!await checkAdminAccess()) return;
    
    const classesContainer = document.getElementById("adminClassList");
    if (!classesContainer) return;
    
    showLoading(classesContainer, "Đang tải danh sách lớp học...");
    
    try {
        const querySnapshot = await getDocs(collection(db, "classes"));
        
        if (querySnapshot.empty) {
            showEmpty(classesContainer, "Chưa có lớp học nào trong hệ thống.");
            return;
        }
        
        classesContainer.innerHTML = `<ul class="divide-y">`;
        
        querySnapshot.forEach((docSnap) => {
            const classData = docSnap.data();
            classesContainer.innerHTML += `
                <li class="py-2">
                    <div class="flex justify-between items-center">
                        <div>
                            <span class="font-medium">${classData.name}</span>
                            <p class="text-sm text-gray-500 line-clamp-1">${classData.description || 'Không có mô tả'}</p>
                        </div>
                        <a href="#" onclick="window.viewClass('${docSnap.id}')" class="text-blue-500 text-sm">
                            <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </li>
            `;
        });
        
        classesContainer.innerHTML += `</ul>`;
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp học:", error);
        showError(classesContainer, "Lỗi khi tải dữ liệu lớp học.");
    }
}

// Tải danh sách nhóm
async function loadGroupsList() {
    if (!await checkAdminAccess()) return;
    
    const groupsContainer = document.getElementById("adminGroupList");
    if (!groupsContainer) return;
    
    showLoading(groupsContainer, "Đang tải danh sách nhóm...");
    
    try {
        const querySnapshot = await getDocs(collection(db, "groups"));
        
        if (querySnapshot.empty) {
            showEmpty(groupsContainer, "Chưa có nhóm nào trong hệ thống.");
            return;
        }
        
        groupsContainer.innerHTML = `<ul class="divide-y">`;
        
        for (const docSnap of querySnapshot.docs) {
            const groupData = docSnap.data();
            const className = await getClassName(groupData.classId);
            
            groupsContainer.innerHTML += `
                <li class="py-2">
                    <div class="flex justify-between items-center">
                        <div>
                            <span class="font-medium">${groupData.name}</span>
                            <p class="text-xs text-blue-500">${className}</p>
                        </div>
                        <a href="#" onclick="window.viewGroup('${docSnap.id}')" class="text-blue-500 text-sm">
                            <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </li>
            `;
        }
        
        groupsContainer.innerHTML += `</ul>`;
    } catch (error) {
        console.error("Lỗi khi tải danh sách nhóm:", error);
        showError(groupsContainer, "Lỗi khi tải dữ liệu nhóm.");
    }
}

// Lấy danh sách thành viên chờ duyệt
async function loadPendingMembers() {
    if (!await checkAdminAccess()) return;
    
    const membersList = document.getElementById("membersList");
    if (!membersList) return;
    
    showLoading(membersList, "Đang tải danh sách thành viên chờ duyệt...");

    try {
        const pendingQuery = query(collection(db, "users"), where("role", "==", "pending"));
        const querySnapshot = await getDocs(pendingQuery);
        
        if (querySnapshot.empty) {
            membersList.innerHTML = "<tr><td colspan='4' class='p-4 text-center'>Không có thành viên nào đang chờ duyệt</td></tr>";
            return;
        }

        membersList.innerHTML = "";
        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const row = `
                <tr>
                    <td class="p-2 border-b">${user.name}</td>
                    <td class="p-2 border-b">${user.email}</td>
                    <td class="p-2 border-b">${user.role}</td>
                    <td class="p-2 border-b text-right">
                        <button onclick="window.approveUser('${docSnap.id}')" class="bg-green-500 text-white px-2 py-1 rounded mr-1">Duyệt</button>
                        <button onclick="window.deleteUser('${docSnap.id}')" class="bg-red-500 text-white px-2 py-1 rounded">Xóa</button>
                    </td>
                </tr>
            `;
            membersList.innerHTML += row;
        });
    } catch (error) {
        console.error("Lỗi khi tải danh sách thành viên:", error);
        showError(membersList, "Lỗi khi tải danh sách thành viên chờ duyệt!");
    }
}

// Tải danh sách tất cả thành viên
async function loadAllMembers() {
    if (!await checkAdminAccess()) return;
    
    const allMembersList = document.getElementById("allMembersList");
    if (!allMembersList) return;
    
    showLoading(allMembersList, "Đang tải danh sách tất cả thành viên...");

    try {
        const currentUser = auth.currentUser;
        const approvedQuery = query(collection(db, "users"), where("role", "!=", "pending"));
        const querySnapshot = await getDocs(approvedQuery);
        
        if (querySnapshot.empty) {
            allMembersList.innerHTML = "<tr><td colspan='4' class='p-4 text-center'>Không có thành viên nào</td></tr>";
            return;
        }

        allMembersList.innerHTML = "";
        querySnapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const isCurrentUser = docSnap.id === currentUser.uid;
            let roleControl;
            
            // Nếu là người dùng hiện tại, không cho phép thay đổi vai trò của chính họ
            if (isCurrentUser) {
                roleControl = `
                    <span class="text-gray-500">
                        ${user.role === 'admin' ? 'Quản trị viên' : user.role === 'teacher' ? 'Giáo viên' : 'Thành viên'}
                    </span>
                `;
            } else {
                roleControl = `
                    <select id="role-${docSnap.id}" class="border rounded p-1 mr-1">
                        <option value="member" ${user.role === 'member' ? 'selected' : ''}>Thành viên</option>
                        <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Giáo viên</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Quản trị</option>
                    </select>
                    <button onclick="window.changeRole('${docSnap.id}')" class="bg-blue-500 text-white px-2 py-1 rounded mr-1">
                        <i class="fas fa-save"></i>
                    </button>
                `;
            }
            
            const row = `
                <tr class="${isCurrentUser ? 'bg-blue-50' : ''}">
                    <td class="p-2 border-b">${user.name}</td>
                    <td class="p-2 border-b">${user.email}</td>
                    <td class="p-2 border-b">
                        ${roleControl}
                    </td>
                    <td class="p-2 border-b text-right">
                        ${isCurrentUser ? 
                            '<span class="text-gray-400">Tài khoản hiện tại</span>' : 
                            `<button onclick="window.deleteUser('${docSnap.id}')" class="bg-red-500 text-white px-2 py-1 rounded">
                                <i class="fas fa-trash mr-1"></i>Xóa
                            </button>`
                        }
                    </td>
                </tr>
            `;
            allMembersList.innerHTML += row;
        });
    } catch (error) {
        console.error("Lỗi khi tải danh sách thành viên:", error);
        showError(allMembersList, "Lỗi khi tải danh sách tất cả thành viên!");
    }
}

// Thay đổi vai trò người dùng
async function changeRole(userId) {
    const roleSelect = document.getElementById(`role-${userId}`);
    if (!roleSelect) return;
    
    const newRole = roleSelect.value;
    
    try {
        await updateDoc(doc(db, "users", userId), { role: newRole });
        alert("Đã thay đổi vai trò thành công!");
        
        // Tải lại tất cả dữ liệu để cập nhật số lượng người dùng
        loadUserStats();
        loadAllMembers();
    } catch (error) {
        console.error("Lỗi khi thay đổi vai trò người dùng:", error);
        alert("Không thể thay đổi vai trò người dùng. Vui lòng thử lại.");
    }
}

// Duyệt tài khoản
async function approveUser(userId) {
    try {
        await updateDoc(doc(db, "users", userId), { role: "member" });
        alert("Tài khoản đã được duyệt!");
        
        // Tải lại tất cả dữ liệu
        loadUserStats();
        loadPendingMembers();
        loadAllMembers();
    } catch (error) {
        console.error("Lỗi khi duyệt tài khoản:", error);
        alert("Không thể duyệt tài khoản. Vui lòng thử lại.");
    }
}

// Xóa tài khoản
async function deleteUser(userId) {
    if (!confirm("Bạn có chắc muốn xóa tài khoản này?")) return;
    
    try {
        await deleteDoc(doc(db, "users", userId));
        alert("Tài khoản đã bị xóa!");
        
        // Tải lại tất cả dữ liệu
        loadUserStats();
        loadPendingMembers();
        loadAllMembers();
    } catch (error) {
        console.error("Lỗi khi xóa tài khoản:", error);
        alert("Không thể xóa tài khoản. Vui lòng thử lại.");
    }
}

// Xử lý điều hướng xem chi tiết lớp học và nhóm
function viewClass(classId) {
    console.log("Xem chi tiết lớp học:", classId);
    // Để phát triển trong tương lai - chuyển đến trang chi tiết lớp học
    alert("Chức năng xem chi tiết lớp học sẽ được phát triển trong tương lai.");
}

function viewGroup(groupId) {
    console.log("Xem chi tiết nhóm:", groupId);
    // Để phát triển trong tương lai - chuyển đến trang chi tiết nhóm
    alert("Chức năng xem chi tiết nhóm sẽ được phát triển trong tương lai.");
}

window.approveUser = approveUser;
window.deleteUser = deleteUser;
window.changeRole = changeRole;
window.viewClass = viewClass;
window.viewGroup = viewGroup;

// Tải dữ liệu khi trang tải
document.addEventListener('DOMContentLoaded', async () => {
    if (await checkAdminAccess()) {
        loadUserStats();
        loadRecentPosts();
        loadClassesList();
        loadGroupsList();
        loadPendingMembers();
        loadAllMembers();
    }
});
