// posts.js - Quản lý bài đăng
import { db, auth } from "./firebase.js";
import { 
    collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc, query, orderBy, where 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { 
    setupMenuToggle, showLoading, showError, showEmpty, waitForAuth, getUserRole, getClassName 
} from "./utils.js";

// Khởi tạo chức năng menu
setupMenuToggle();

// Thêm bài đăng mới
async function addPost() {
    const user = auth.currentUser;
    if (!user) {
        alert("Bạn cần đăng nhập để đăng bài!");
        return;
    }
    
    const postTitle = document.getElementById("postTitle").value;
    const postContent = document.getElementById("postContent").value;
    const classId = document.getElementById("classId").value;

    if (!postTitle || !postContent) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
    }

    try {
        // Kiểm tra quyền đăng bài chỉ khi chọn lớp học cụ thể
        if (classId) {
            const userRole = await getUserRole(user.uid);
            if (userRole !== "admin") {
                // Kiểm tra xem người dùng có phải là thành viên của lớp học không
                const isMember = await isClassMember(classId);
                if (!isMember) {
                    alert("Bạn không phải là thành viên của lớp học này nên không thể đăng bài ở đây!");
                    return;
                }
            }
        }
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userName = userDoc.exists() ? userDoc.data().name : "Người dùng";
        
        await addDoc(collection(db, "posts"), { 
            title: postTitle, 
            content: postContent, 
            classId: classId || null,  // null nghĩa là hiển thị cho tất cả
            createdAt: new Date().toISOString(),
            authorId: user.uid,
            authorName: userName
        });
        alert("Bài đăng đã được tạo!");
        
        // Xóa form
        document.getElementById("postTitle").value = "";
        document.getElementById("postContent").value = "";
        document.getElementById("classId").value = "";
        
        loadPosts();
    } catch (error) {
        console.error("Lỗi khi thêm bài đăng:", error);
        alert("Không thể tạo bài đăng. Vui lòng thử lại.");
    }
}

// Xóa bài đăng
async function deletePost(postId) {
    if (!confirm("Bạn có chắc muốn xóa bài đăng này?")) return;
    
    try {
        await deleteDoc(doc(db, "posts", postId));
        alert("Bài đăng đã bị xóa!");
        loadPosts();
    } catch (error) {
        console.error("Lỗi khi xóa bài đăng:", error);
        alert("Không thể xóa bài đăng. Vui lòng thử lại.");
    }
}

// Cập nhật bài đăng
async function updatePost(postId) {
    try {
        // Lấy thông tin bài đăng
        const postDoc = await getDoc(doc(db, "posts", postId));
        if (!postDoc.exists()) {
            alert("Không tìm thấy bài đăng!");
            return;
        }
        
        const postData = postDoc.data();
        
        // Điền thông tin vào modal
        document.getElementById("updatePostId").value = postId;
        document.getElementById("updatePostTitle").value = postData.title || "";
        document.getElementById("updatePostContent").value = postData.content || "";
        document.getElementById("updateClassId").value = postData.classId || "";
        
        // Hiển thị modal
        document.getElementById("updatePostModal").classList.remove("hidden");
    } catch (error) {
        console.error("Lỗi khi lấy thông tin bài đăng:", error);
        alert("Không thể cập nhật bài đăng. Vui lòng thử lại.");
    }
}

// Lưu bài đăng đã cập nhật
async function saveUpdatedPost() {
    const postId = document.getElementById("updatePostId").value;
    const title = document.getElementById("updatePostTitle").value;
    const content = document.getElementById("updatePostContent").value;
    const classId = document.getElementById("updateClassId").value;
    
    if (!title || !content) {
        alert("Vui lòng nhập tiêu đề và nội dung");
        return;
    }
    
    try {
        const user = auth.currentUser;
        if (!user) {
            alert("Bạn cần đăng nhập để cập nhật bài đăng!");
            return;
        }
        
        // Lấy thông tin bài đăng hiện tại
        const postDoc = await getDoc(doc(db, "posts", postId));
        if (!postDoc.exists()) {
            alert("Không tìm thấy bài đăng!");
            return;
        }
        
        // Kiểm tra quyền cập nhật bài đăng
        const userRole = await getUserRole(user.uid);
        const isAuthor = postDoc.data().authorId === user.uid;
        
        // Nếu không phải admin và không phải tác giả, kiểm tra thêm
        if (userRole !== "admin" && !isAuthor) {
            alert("Bạn không có quyền cập nhật bài đăng này!");
            return;
        }
        
        // Kiểm tra quyền với lớp học được chọn (chỉ khi chọn lớp học cụ thể)
        if (classId && userRole !== "admin") {
            const isMember = await isClassMember(classId);
            if (!isMember) {
                alert("Bạn không phải là thành viên của lớp học này nên không thể chuyển bài đăng sang đây!");
                return;
            }
        }
        
        await updateDoc(doc(db, "posts", postId), {
            title,
            content,
            classId: classId || null, // null khi chọn "Tất cả"
            updatedAt: new Date().toISOString()
        });
        
        // Ẩn modal
        document.getElementById("updatePostModal").classList.add("hidden");
        
        alert("Cập nhật bài đăng thành công!");
        loadPosts();
    } catch (error) {
        console.error("Lỗi khi cập nhật bài đăng:", error);
        alert("Không thể cập nhật bài đăng. Vui lòng thử lại.");
    }
}

// Hiển thị danh sách bài đăng
async function loadPosts() {
    const postList = document.getElementById("postList");
    if (!postList) return;
    
    showLoading(postList, "Đang tải danh sách bài đăng...");

    // Đảm bảo người dùng đã đăng nhập
    const user = await waitForAuth();
    if (!user) {
        showError(postList, "Bạn cần đăng nhập để xem bài đăng");
        return;
    }

    try {
        // Kiểm tra quyền người dùng
        const userRole = await getUserRole(user.uid);
        const isAdminOrTeacher = userRole === "admin" || userRole === "teacher";
        
        const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(postsQuery);
        
        if (querySnapshot.empty) {
            showEmpty(postList, "Chưa có bài đăng nào");
            return;
        }

        postList.innerHTML = "";

        for (const docSnap of querySnapshot.docs) {
            const postData = docSnap.data();
            const className = await getClassName(postData.classId);
            const canEdit = isAdminOrTeacher || postData.authorId === user.uid;
            
            const postItem = document.createElement('div');
            postItem.className = 'bg-white rounded-lg shadow-md p-4 mb-4';
            postItem.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <h3 class="text-xl font-semibold">${postData.title}</h3>
                    <div class="flex items-center">
                        <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            <i class="fas fa-graduation-cap mr-1"></i>${className}
                        </span>
                        ${canEdit ? `
                        <div class="ml-2 dropdown relative">
                            <button class="text-gray-500 hover:text-gray-700">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="dropdown-menu absolute right-0 mt-2 w-32 bg-white shadow-lg rounded hidden z-10">
                                <button onclick="window.updatePost('${docSnap.id}')" class="w-full text-left px-4 py-2 hover:bg-gray-100">
                                    <i class="fas fa-edit mr-1"></i> Sửa
                                </button>
                                <button onclick="window.deletePost('${docSnap.id}')" class="w-full text-left px-4 py-2 hover:bg-gray-100">
                                    <i class="fas fa-trash mr-1"></i> Xóa
                                </button>
                            </div>
                        </div>` : ''}
                    </div>
                </div>
                <p class="text-gray-700 mb-3">${postData.content}</p>
                <div class="flex justify-between items-center text-sm text-gray-500">
                    <span>
                        <i class="fas fa-user mr-1"></i>${postData.authorName || 'Người dùng'}
                    </span>
                    <span>
                        <i class="far fa-clock mr-1"></i>${new Date(postData.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                </div>
            `;
            
            postList.appendChild(postItem);
        }
        
        // Thiết lập menu dropdown
        setupDropdownMenus();
    } catch (error) {
        console.error("Lỗi khi tải bài đăng:", error);
        showError(postList, "Lỗi khi tải dữ liệu! Vui lòng thử lại sau.");
    }
}

// Thiết lập menu dropdown cho các bài đăng
function setupDropdownMenus() {
    const dropdownButtons = document.querySelectorAll('.dropdown button');
    
    dropdownButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const menu = button.nextElementSibling;
            menu.classList.toggle('hidden');
            
            // Đóng các menu khác
            document.querySelectorAll('.dropdown-menu').forEach(otherMenu => {
                if (otherMenu !== menu) {
                    otherMenu.classList.add('hidden');
                }
            });
        });
    });
    
    // Đóng dropdown khi click ngoài menu
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    });
}

// Tải danh sách lớp học cho dropdown
async function loadClassDropdown() {
    const classSelect = document.getElementById("classId");
    const updateClassSelect = document.getElementById("updateClassId");
    
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Kiểm tra vai trò người dùng
        const userRole = await getUserRole(user.uid);
        const isAdmin = userRole === "admin";
        
        let options;
        
        // Bắt đầu với tùy chọn "Tất cả" cho mọi người dùng
        let optionsArray = ['<option value="">Tất cả</option>'];
        
        // Nếu là admin, hiển thị tất cả lớp học
        if (isAdmin) {
            const querySnapshot = await getDocs(collection(db, "classes"));
            querySnapshot.forEach((doc) => {
                optionsArray.push(`<option value="${doc.id}">${doc.data().name}</option>`);
            });
        } else {
            // Nếu là thành viên hoặc giáo viên, chỉ hiển thị lớp học mà họ tham gia
            const userClassIds = await getUserClasses(user.uid);
            
            if (userClassIds.length > 0) {
                for (const classId of userClassIds) {
                    const classDoc = await getDoc(doc(db, "classes", classId));
                    if (classDoc.exists()) {
                        optionsArray.push(`<option value="${classId}">${classDoc.data().name}</option>`);
                    }
                }
            }
        }
        
        options = optionsArray.join('');
        
        if (classSelect) classSelect.innerHTML = options;
        if (updateClassSelect) updateClassSelect.innerHTML = options;
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp học:", error);
        const errorOption = '<option value="">Lỗi khi tải lớp học</option>';
        if (classSelect) classSelect.innerHTML = errorOption;
        if (updateClassSelect) updateClassSelect.innerHTML = errorOption;
    }
}

window.addPost = addPost;
window.deletePost = deletePost;
window.updatePost = updatePost;
window.saveUpdatedPost = saveUpdatedPost;

// Khởi tạo khi trang được tải
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await waitForAuth();
        loadClassDropdown();
        loadPosts();
        
        // Các sự kiện
        document.getElementById("addPostBtn")?.addEventListener("click", addPost);
        document.getElementById("cancelUpdatePost")?.addEventListener("click", () => {
            document.getElementById("updatePostModal").classList.add("hidden");
        });
        document.getElementById("confirmUpdatePost")?.addEventListener("click", saveUpdatedPost);
    } catch (error) {
        console.error("Lỗi khởi tạo trang bài đăng:", error);
    }
});
