// assignments.js
import { db, auth, onAuthStateChanged } from "./firebase.js";
import { 
    collection, addDoc, getDocs, deleteDoc, doc, getDoc, updateDoc, query, where, orderBy 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { 
    setupMenuToggle, getUserRole, getClassName, getUserClasses, 
    showLoading, showError, showEmpty, waitForAuth 
} from "./utils.js";

// Initialize menu toggle
setupMenuToggle();

// Thêm bài tập (chỉ admin hoặc giáo viên mới có quyền)
async function addAssignment() {
    const user = auth.currentUser;
    if (!user) {
        alert("Bạn cần đăng nhập!");
        return;
    }

    const title = document.getElementById("assignmentTitle").value;
    const description = document.getElementById("assignmentDescription").value;
    const classId = document.getElementById("classId").value;
    const dueDate = document.getElementById("assignmentDueDate").value;
    
    if (!title || !description || !classId) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
    }

    try {
        const role = await getUserRole(user.uid);
        if (role !== "admin" && role !== "teacher") {
            alert("Bạn không có quyền thêm bài tập!");
            return;
        }

        await addDoc(collection(db, "assignments"), { 
            title, 
            description, 
            classId,
            dueDate: dueDate || null,
            createdBy: user.uid,
            createdAt: new Date().toISOString()
        });
        
        alert("Bài tập đã được thêm!");
        // Clear form
        document.getElementById("assignmentTitle").value = "";
        document.getElementById("assignmentDescription").value = "";
        document.getElementById("assignmentDueDate").value = "";
        
        loadAssignments();
    } catch (error) {
        console.error("Lỗi khi thêm bài tập:", error);
        alert("Không thể thêm bài tập. Vui lòng thử lại.");
    }
}

// Xóa bài tập
async function deleteAssignment(assignmentId) {
    if (!confirm("Bạn có chắc muốn xóa bài tập này?")) return;
    
    try {
        await deleteDoc(doc(db, "assignments", assignmentId));
        alert("Bài tập đã bị xóa!");
        loadAssignments();
    } catch (error) {
        console.error("Lỗi khi xóa bài tập:", error);
        alert("Không thể xóa bài tập. Vui lòng thử lại.");
    }
}

// Cập nhật bài tập
async function updateAssignment(assignmentId) {
    try {
        const assignmentDoc = await getDoc(doc(db, "assignments", assignmentId));
        if (!assignmentDoc.exists()) {
            alert("Bài tập không tồn tại!");
            return;
        }
        
        const assignmentData = assignmentDoc.data();
        
        // Fill the modal with assignment data
        document.getElementById("updateAssignmentId").value = assignmentId;
        document.getElementById("updateAssignmentTitle").value = assignmentData.title || "";
        document.getElementById("updateAssignmentDescription").value = assignmentData.description || "";
        
        // Set due date if exists
        if (assignmentData.dueDate) {
            // Format date to YYYY-MM-DD for input[type=date]
            const dueDate = new Date(assignmentData.dueDate);
            const formattedDate = dueDate.toISOString().split('T')[0];
            document.getElementById("updateAssignmentDueDate").value = formattedDate;
        } else {
            document.getElementById("updateAssignmentDueDate").value = "";
        }
        
        // Fill class dropdown and select current class
        await loadUpdateClassDropdown(assignmentData.classId);
        
        // Show the modal
        document.getElementById("updateAssignmentModal").classList.remove("hidden");
    } catch (error) {
        console.error("Lỗi khi lấy thông tin bài tập:", error);
        alert("Không thể cập nhật bài tập. Vui lòng thử lại.");
    }
}

// Save updated assignment
async function saveUpdatedAssignment() {
    const assignmentId = document.getElementById("updateAssignmentId").value;
    const title = document.getElementById("updateAssignmentTitle").value;
    const description = document.getElementById("updateAssignmentDescription").value;
    const classId = document.getElementById("updateClassId").value;
    const dueDate = document.getElementById("updateAssignmentDueDate").value;
    
    if (!title || !description || !classId) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
    }
    
    try {
        await updateDoc(doc(db, "assignments", assignmentId), {
            title,
            description,
            classId,
            dueDate: dueDate || null,
            updatedAt: new Date().toISOString()
        });
        
        // Hide modal
        document.getElementById("updateAssignmentModal").classList.add("hidden");
        
        alert("Cập nhật bài tập thành công!");
        loadAssignments();
    } catch (error) {
        console.error("Lỗi khi cập nhật bài tập:", error);
        alert("Không thể cập nhật bài tập. Vui lòng thử lại.");
    }
}

// Load class dropdown for update modal
async function loadUpdateClassDropdown(selectedClassId) {
    const classSelect = document.getElementById("updateClassId");
    if (!classSelect) return;
    
    try {
        classSelect.innerHTML = '<option value="">-- Chọn lớp học --</option>';
        const querySnapshot = await getDocs(collection(db, "classes"));
        
        querySnapshot.forEach((docSnap) => {
            const classData = docSnap.data();
            const selected = docSnap.id === selectedClassId ? 'selected' : '';
            classSelect.innerHTML += `<option value="${docSnap.id}" ${selected}>${classData.name}</option>`;
        });
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp học:", error);
    }
}

// Hiển thị danh sách bài tập
async function loadAssignments() {
    const assignmentList = document.getElementById("assignmentList");
    if (!assignmentList) return;
    
    showLoading(assignmentList, "Đang tải danh sách bài tập...");

    // Ensure auth is ready
    const user = await waitForAuth();
    if (!user) {
        showError(assignmentList, "Bạn cần đăng nhập để xem bài tập");
        return;
    }

    try {
        // Check user role and access permissions
        const userRole = await getUserRole(user.uid);
        const isAdminOrTeacher = userRole === "admin" || userRole === "teacher";
        
        // For regular members, get their enrolled classes
        const userClassIds = isAdminOrTeacher ? [] : await getUserClasses(user.uid);
        
        const classFilter = document.getElementById("classFilter")?.value;
        let assignmentsQuery;
        
        if (classFilter) {
            assignmentsQuery = query(collection(db, "assignments"), where("classId", "==", classFilter));
        } else {
            assignmentsQuery = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
        }
        
        const querySnapshot = await getDocs(assignmentsQuery);
        
        if (querySnapshot.empty) {
            showEmpty(assignmentList, "Chưa có bài tập nào");
            return;
        }

        assignmentList.innerHTML = "";
        let hasVisibleAssignments = false;

        for (const docSnap of querySnapshot.docs) {
            const assignmentData = docSnap.data();
            
            // Skip if user is not admin/teacher and not enrolled in the class
            if (!isAdminOrTeacher && !userClassIds.includes(assignmentData.classId)) {
                continue;
            }
            
            hasVisibleAssignments = true;
            const className = await getClassName(assignmentData.classId);
            const dueDateDisplay = assignmentData.dueDate 
                ? `<span class="text-red-600"><i class="far fa-clock mr-1"></i>Hạn nộp: ${new Date(assignmentData.dueDate).toLocaleDateString('vi-VN')}</span>` 
                : "";
            
            const assignmentCard = document.createElement('div');
            assignmentCard.className = 'bg-white rounded-lg shadow-md p-4';
            assignmentCard.innerHTML = `
                <div class="border-b pb-3 mb-3">
                    <h3 class="text-xl font-bold">${assignmentData.title}</h3>
                    <div class="flex items-center justify-between text-sm mt-1">
                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            <i class="fas fa-graduation-cap mr-1"></i>${className}
                        </span>
                        ${dueDateDisplay}
                    </div>
                </div>
                <p class="text-gray-700 mb-4">${assignmentData.description}</p>
                ${isAdminOrTeacher ? `
                <div class="flex justify-end space-x-2">
                    <button onclick="window.updateAssignment('${docSnap.id}')" class="px-3 py-1 bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200">
                        <i class="fas fa-edit mr-1"></i>Sửa
                    </button>
                    <button onclick="window.deleteAssignment('${docSnap.id}')" class="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200">
                        <i class="fas fa-trash mr-1"></i>Xóa
                    </button>
                </div>` : ''}
            `;
            
            assignmentList.appendChild(assignmentCard);
        }
        
        if (!hasVisibleAssignments) {
            showEmpty(assignmentList, "Bạn không có quyền xem bài tập nào hoặc chưa tham gia lớp học nào");
        }
    } catch (error) {
        console.error("Lỗi khi tải bài tập:", error);
        showError(assignmentList, "Lỗi khi tải dữ liệu! Vui lòng thử lại sau.");
    }
}

// Load class dropdown
async function loadClassDropdown() {
    const classSelect = document.getElementById("classId");
    const classFilter = document.getElementById("classFilter");
    
    try {
        const querySnapshot = await getDocs(collection(db, "classes"));
        
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Chọn lớp học</option>';
            querySnapshot.forEach((docSnap) => {
                const classData = docSnap.data();
                classSelect.innerHTML += `<option value="${docSnap.id}">${classData.name}</option>`;
            });
        }
        
        if (classFilter) {
            classFilter.innerHTML = '<option value="">Tất cả lớp học</option>';
            querySnapshot.forEach((docSnap) => {
                const classData = docSnap.data();
                classFilter.innerHTML += `<option value="${docSnap.id}">${classData.name}</option>`;
            });
        }
    } catch (error) {
        console.error("Lỗi khi tải danh sách lớp học:", error);
    }
}

window.addAssignment = addAssignment;
window.deleteAssignment = deleteAssignment;
window.updateAssignment = updateAssignment;

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = auth.currentUser;
        // Wait for auth if needed
        if (!user) {
            await new Promise(resolve => {
                const unsubscribe = onAuthStateChanged(auth, user => {
                    unsubscribe();
                    resolve(user);
                });
            });
        }
        
        // Check if user is admin or teacher to show/hide assignment creation form
        const currentUser = auth.currentUser;
        if (currentUser) {
            const userRole = await getUserRole(currentUser.uid);
            const isAdminOrTeacher = userRole === "admin" || userRole === "teacher";
            
            // Hide assignment creation form for regular members
            const assignmentForm = document.querySelector('.lg\\:col-span-1');
            if (assignmentForm && !isAdminOrTeacher) {
                assignmentForm.innerHTML = `
                    <div class="bg-white p-4 rounded-lg shadow-md">
                        <h3 class="text-lg font-semibold mb-4">Lọc theo lớp học</h3>
                        <select id="classFilter" class="w-full px-3 py-2 border rounded">
                            <option value="">Tất cả lớp học</option>
                            <!-- Class list will be loaded by JS -->
                        </select>
                    </div>
                `;
            }
        }
        
        loadClassDropdown();
        loadAssignments();
        
        // Only add click handler if the button exists and user is admin/teacher
        const addButton = document.getElementById("addAssignmentBtn");
        if (addButton) {
            addButton.addEventListener("click", addAssignment);
        }
        
        document.getElementById("classFilter")?.addEventListener("change", loadAssignments);
        document.getElementById("searchBtn")?.addEventListener("click", loadAssignments);
        
        // Modal event listeners for update
        document.getElementById("cancelUpdateAssignment")?.addEventListener("click", () => {
            document.getElementById("updateAssignmentModal").classList.add("hidden");
        });
        
        document.getElementById("confirmUpdateAssignment")?.addEventListener("click", saveUpdatedAssignment);
    } catch (error) {
        console.error("Error initializing assignments page:", error);
    }
});
