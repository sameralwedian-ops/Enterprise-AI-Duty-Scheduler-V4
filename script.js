/* ============================================================================
   ENTERPRISE AI DUTY SCHEDULER V4 - COMPLETE JAVASCRIPT
   ============================================================================ */

class SchedulerApp {
    constructor() {
        this.employees = [];
        this.schedule = {};
        this.requests = [];
        this.settings = this.loadSettings();
        this.history = [];
        this.historyIndex = -1;
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.backupHistory = [];
        this.autoSaveTimer = null;
        this.lockedCells = new Set();
        this.lockedEmployees = new Set();
        this.lockedDays = new Set();
        this.editingCell = null;
        this.selectedSchedule = null;
        
        this.initializeUI();
        this.loadData();
        this.setupEventListeners();
        this.startAutoSave();
    }

    loadSettings() {
        const saved = localStorage.getItem('scheduler_settings');
        return saved ? JSON.parse(saved) : {
            defaultMonth: 'current',
            autosaveInterval: 30,
            minCoverage: 60,
            maxConsecutiveNights: 3,
            maxNightPerWeek: 3,
            simulations: 1000,
            weightFairness: 30,
            weightCoverage: 30,
            weightFatigue: 25,
            weightBalance: 15
        };
    }

    saveSettings() {
        localStorage.setItem('scheduler_settings', JSON.stringify(this.settings));
    }

    loadData() {
        const saved = localStorage.getItem('scheduler_data');
        if (saved) {
            const data = JSON.parse(saved);
            this.employees = data.employees || [];
            this.schedule = data.schedule || {};
            this.requests = data.requests || [];
            this.lockedCells = new Set(data.lockedCells || []);
            this.lockedEmployees = new Set(data.lockedEmployees || []);
            this.lockedDays = new Set(data.lockedDays || []);
            this.backupHistory = data.backupHistory || [];
        }
        this.renderSchedule();
        this.renderEmployees();
        this.renderRequests();
        this.updateDashboard();
    }

    saveData() {
        const data = {
            employees: this.employees,
            schedule: this.schedule,
            requests: this.requests,
            lockedCells: Array.from(this.lockedCells),
            lockedEmployees: Array.from(this.lockedEmployees),
            lockedDays: Array.from(this.lockedDays),
            backupHistory: this.backupHistory
        };
        localStorage.setItem('scheduler_data', JSON.stringify(data));
        this.saveToHistory();
    }

    initializeUI() {
        const now = new Date();
        this.currentMonth = now.getMonth();
        this.currentYear = now.getFullYear();
        
        document.getElementById('month-selector').value = this.currentMonth;
        
        const yearSelector = document.getElementById('year-selector');
        for (let i = now.getFullYear() - 2; i <= now.getFullYear() + 5; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            if (i === now.getFullYear()) option.selected = true;
            yearSelector.appendChild(option);
        }

        document.body.classList.remove('dark-mode');
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        }
    }

    setupEventListeners() {
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('backup-btn').addEventListener('click', () => this.openBackupModal());
        document.getElementById('export-btn').addEventListener('click', () => this.exportToExcel());
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        document.getElementById('ai-generate-btn').addEventListener('click', () => this.openAISimulation());
        document.getElementById('auto-balance-btn').addEventListener('click', () => this.autoBalance());
        document.getElementById('prev-month').addEventListener('click', () => this.previousMonth());
        document.getElementById('next-month').addEventListener('click', () => this.nextMonth());
        document.getElementById('month-selector').addEventListener('change', (e) => {
            this.currentMonth = parseInt(e.target.value);
            this.renderSchedule();
        });
        document.getElementById('year-selector').addEventListener('change', (e) => {
            this.currentYear = parseInt(e.target.value);
            this.renderSchedule();
        });

        document.getElementById('add-employee-btn').addEventListener('click', () => this.openEmployeeModal());
        document.getElementById('add-request-btn').addEventListener('click', () => this.openRequestModal());

        document.getElementById('modal-overlay').addEventListener('click', () => this.closeAllModals());
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        document.getElementById('employee-modal-save').addEventListener('click', () => this.saveEmployee());
        document.getElementById('employee-modal-cancel').addEventListener('click', () => this.closeAllModals());
        document.getElementById('request-modal-save').addEventListener('click', () => this.saveRequest());
        document.getElementById('request-modal-cancel').addEventListener('click', () => this.closeAllModals());
        document.getElementById('cell-edit-save').addEventListener('click', () => this.saveCell());
        document.getElementById('cell-edit-cancel').addEventListener('click', () => this.closeAllModals());

        document.getElementById('create-backup-btn').addEventListener('click', () => this.createBackup());
        document.getElementById('restore-backup-btn').addEventListener('click', () => this.restoreBackup());
        document.getElementById('backup-modal-close').addEventListener('click', () => this.closeAllModals());

        document.getElementById('ai-simulation-cancel').addEventListener('click', () => this.closeAllModals());
        document.getElementById('ai-simulation-apply').addEventListener('click', () => this.applyBestSchedule());

        document.getElementById('clear-cache-btn').addEventListener('click', () => this.clearCache());
        
        // Settings listeners
        ['setting-default-month', 'setting-autosave', 'setting-min-coverage', 'setting-max-consecutive-nights', 
         'setting-max-night-per-week', 'setting-simulations', 'setting-weight-fairness', 'setting-weight-coverage',
         'setting-weight-fatigue', 'setting-weight-balance'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.updateSettings());
            }
        });

        document.getElementById('request-filter').addEventListener('change', () => this.renderRequests());
        document.getElementById('employee-search').addEventListener('input', () => this.filterSchedule());
        document.getElementById('employees-search').addEventListener('input', () => this.filterEmployees());
    }

    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    switchView(viewName) {
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-view="${viewName}"]`).previousElementSibling || 
            Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.dataset.view === viewName)?.classList.add('active');
        
        document.querySelector(`button[data-view="${viewName}"]`).classList.add('active');

        if (viewName === 'dashboard') {
            this.updateDashboard();
        }
    }

    openEmployeeModal(employeeId = null) {
        const modal = document.getElementById('employee-modal');
        const title = document.getElementById('employee-modal-title');
        
        if (employeeId) {
            const emp = this.employees.find(e => e.id === employeeId);
            title.textContent = 'Edit Employee';
            document.getElementById('emp-id').value = emp.empId;
            document.getElementById('emp-name').value = emp.name;
            document.getElementById('emp-position').value = emp.position;
            document.getElementById('emp-shift-morning').checked = emp.shifts.includes('M');
            document.getElementById('emp-shift-evening').checked = emp.shifts.includes('E');
            document.getElementById('emp-shift-night').checked = emp.shifts.includes('N');
            document.getElementById('emp-al-balance').value = emp.annualLeave;
            document.getElementById('emp-cl-balance').value = emp.casualLeave;
            document.getElementById('emp-status').value = emp.status;
            document.getElementById('emp-locked').checked = this.lockedEmployees.has(employeeId);
            modal.dataset.editingId = employeeId;
        } else {
            title.textContent = 'Add Employee';
            document.getElementById('emp-id').value = '';
            document.getElementById('emp-name').value = '';
            document.getElementById('emp-position').value = '';
            document.getElementById('emp-shift-morning').checked = true;
            document.getElementById('emp-shift-evening').checked = true;
            document.getElementById('emp-shift-night').checked = true;
            document.getElementById('emp-al-balance').value = 20;
            document.getElementById('emp-cl-balance').value = 8;
            document.getElementById('emp-status').value = 'active';
            document.getElementById('emp-locked').checked = false;
            delete modal.dataset.editingId;
        }
        
        this.openModal('employee-modal');
    }

    saveEmployee() {
        const empId = document.getElementById('emp-id').value;
        const name = document.getElementById('emp-name').value;
        const position = document.getElementById('emp-position').value;
        const shifts = [];
        if (document.getElementById('emp-shift-morning').checked) shifts.push('M');
        if (document.getElementById('emp-shift-evening').checked) shifts.push('E');
        if (document.getElementById('emp-shift-night').checked) shifts.push('N');
        const alBalance = parseInt(document.getElementById('emp-al-balance').value);
        const clBalance = parseInt(document.getElementById('emp-cl-balance').value);
        const status = document.getElementById('emp-status').value;
        const locked = document.getElementById('emp-locked').checked;

        if (!empId || !name || shifts.length === 0) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        const modal = document.getElementById('employee-modal');
        const editingId = modal.dataset.editingId;

        if (editingId) {
            const emp = this.employees.find(e => e.id === editingId);
            emp.empId = empId;
            emp.name = name;
            emp.position = position;
            emp.shifts = shifts;
            emp.annualLeave = alBalance;
            emp.casualLeave = clBalance;
            emp.status = status;
            if (locked) {
                this.lockedEmployees.add(editingId);
            } else {
                this.lockedEmployees.delete(editingId);
            }
        } else {
            const id = 'emp_' + Date.now();
            this.employees.push({
                id,
                empId,
                name,
                position,
                shifts,
                annualLeave: alBalance,
                casualLeave: clBalance,
                status,
                usedAnnualLeave: 0,
                usedCasualLeave: 0
            });
        }

        this.saveData();
        this.renderEmployees();
        this.renderSchedule();
        this.closeAllModals();
        this.showToast('Employee saved successfully');
    }

    openRequestModal(requestId = null) {
        const modal = document.getElementById('request-modal');
        const empSelect = document.getElementById('req-employee');
        
        empSelect.innerHTML = '';
        this.employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.name;
            empSelect.appendChild(option);
        });

        if (requestId) {
            const req = this.requests.find(r => r.id === requestId);
            document.getElementById('req-employee').value = req.employeeId;
            document.getElementById('req-type').value = req.type;
            document.getElementById('req-start-date').value = req.startDate;
            document.getElementById('req-end-date').value = req.endDate;
            document.getElementById('req-details').value = req.details;
            document.getElementById('req-status').value = req.status;
            modal.dataset.editingId = requestId;
        } else {
            document.getElementById('req-type').value = 'shift_preference';
            document.getElementById('req-details').value = '';
            document.getElementById('req-status').value = 'pending';
            delete modal.dataset.editingId;
        }

        this.openModal('request-modal');
    }

    saveRequest() {
        const employeeId = document.getElementById('req-employee').value;
        const type = document.getElementById('req-type').value;
        const startDate = document.getElementById('req-start-date').value;
        const endDate = document.getElementById('req-end-date').value;
        const details = document.getElementById('req-details').value;
        const status = document.getElementById('req-status').value;

        if (!employeeId || !startDate || !endDate) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        const modal = document.getElementById('request-modal');
        const editingId = modal.dataset.editingId;

        if (editingId) {
            const req = this.requests.find(r => r.id === editingId);
            req.employeeId = employeeId;
            req.type = type;
            req.startDate = startDate;
            req.endDate = endDate;
            req.details = details;
            req.status = status;
        } else {
            this.requests.push({
                id: 'req_' + Date.now(),
                employeeId,
                type,
                startDate,
                endDate,
                details,
                status,
                createdAt: new Date().toISOString()
            });
        }

        this.saveData();
        this.renderRequests();
        this.closeAllModals();
        this.showToast('Request saved successfully');
    }

    renderSchedule() {
        const table = document.getElementById('schedule-table');
        const tbody = document.getElementById('schedule-body');
        const thead = table.querySelector('thead tr');

        const monthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
        if (!this.schedule[monthKey]) {
            this.schedule[monthKey] = {};
        }

        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();

        while (thead.children.length > 1) {
            thead.removeChild(thead.lastChild);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(this.currentYear, this.currentMonth, day);
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
            const th = document.createElement('th');
            th.className = 'date-header-cell';
            th.innerHTML = `<div>${dayName}</div><div style="font-size:11px">${day}</div>`;
            if (dayName === 'Fri' || dayName === 'Sat') {
                th.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            }
            thead.appendChild(th);
        }

        tbody.innerHTML = '';

        const activeEmployees = this.employees.filter(e => e.status === 'active');

        activeEmployees.forEach(employee => {
            const row = document.createElement('tr');
            const empCell = document.createElement('td');
            empCell.className = 'employee-cell';
            empCell.innerHTML = `<strong>${employee.name}</strong><br><small>${employee.position}</small>`;
            row.appendChild(empCell);

            if (!this.schedule[monthKey][employee.id]) {
                this.schedule[monthKey][employee.id] = {};
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = String(day).padStart(2, '0');
                const cellKey = `${monthKey}-${employee.id}-${dateStr}`;
                const shift = this.schedule[monthKey][employee.id][dateStr] || 'OFF';
                const isLocked = this.lockedCells.has(cellKey);

                const td = document.createElement('td');
                td.className = 'shift-cell' + (isLocked ? ' locked' : '');
                
                const badge = document.createElement('div');
                badge.className = `shift-badge ${this.getShiftClass(shift)}`;
                badge.textContent = shift;
                td.appendChild(badge);

                td.addEventListener('click', () => this.openCellEditModal(employee, day, dateStr, cellKey));
                row.appendChild(td);
            }

            tbody.appendChild(row);
        });

        this.saveData();
    }

    getShiftClass(shift) {
        const mapping = {
            'M': 'morning',
            'E': 'evening',
            'N': 'night',
            'OFF': 'off',
            'AL': 'al',
            'CL': 'cl'
        };
        return mapping[shift] || 'off';
    }

    openCellEditModal(employee, day, dateStr, cellKey) {
        const monthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
        const shift = this.schedule[monthKey][employee.id][dateStr] || 'OFF';
        const isLocked = this.lockedCells.has(cellKey);

        document.getElementById('cell-emp-name').textContent = employee.name;
        document.getElementById('cell-date').textContent = new Date(this.currentYear, this.currentMonth, day).toDateString();
        document.getElementById('cell-lock').checked = isLocked;

        document.querySelectorAll('#cell-edit-modal .btn-toggle').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.shift === shift) {
                btn.classList.add('active');
            }
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#cell-edit-modal .btn-toggle').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        const modal = document.getElementById('cell-edit-modal');
        modal.dataset.cellKey = cellKey;
        modal.dataset.employeeId = employee.id;
        modal.dataset.dateStr = dateStr;
        modal.dataset.monthKey = monthKey;

        this.openModal('cell-edit-modal');
    }

    saveCell() {
        const modal = document.getElementById('cell-edit-modal');
        const cellKey = modal.dataset.cellKey;
        const employeeId = modal.dataset.employeeId;
        const dateStr = modal.dataset.dateStr;
        const monthKey = modal.dataset.monthKey;
        const isLocked = document.getElementById('cell-lock').checked;

        const selectedShift = document.querySelector('#cell-edit-modal .btn-toggle.active');
        const shift = selectedShift ? selectedShift.dataset.shift : 'OFF';

        this.schedule[monthKey][employeeId][dateStr] = shift;

        if (isLocked) {
            this.lockedCells.add(cellKey);
        } else {
            this.lockedCells.delete(cellKey);
        }

        this.saveData();
        this.renderSchedule();
        this.closeAllModals();
        this.showToast('Shift updated successfully');
    }

    renderEmployees() {
        const grid = document.getElementById('employees-grid');
        grid.innerHTML = '';

        this.employees.forEach(employee => {
            const card = document.createElement('div');
            card.className = 'employee-card';

            const statusClass = employee.status === 'active' ? 'active' : 'inactive';
            card.innerHTML = `
                <div class="employee-card-header">
                    <div>
                        <div class="employee-card-title">${employee.name}</div>
                        <div class="employee-card-id">${employee.empId}</div>
                    </div>
                    <span class="employee-card-status ${statusClass}">${employee.status.toUpperCase()}</span>
                </div>
                <div class="employee-card-body">
                    <div><strong>Position:</strong> ${employee.position}</div>
                    <div><strong>Available Shifts:</strong></div>
                    <div class="employee-card-shifts">
                        ${employee.shifts.map(s => `<span class="shift-badge ${this.getShiftClass(s)}">${s}</span>`).join('')}
                    </div>
                    <div><strong>AL Balance:</strong> ${employee.annualLeave - (employee.usedAnnualLeave || 0)}/${employee.annualLeave}</div>
                    <div><strong>CL Balance:</strong> ${employee.casualLeave - (employee.usedCasualLeave || 0)}/${employee.casualLeave}</div>
                </div>
                <div class="employee-card-footer">
                    <button class="btn btn-secondary" onclick="app.openEmployeeModal('${employee.id}')">Edit</button>
                    <button class="btn btn-secondary" onclick="app.deleteEmployee('${employee.id}')">Delete</button>
                </div>
            `;

            grid.appendChild(card);
        });

        if (this.employees.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px;">No employees added yet. Click "Add Employee" to get started.</p>';
        }
    }

    deleteEmployee(employeeId) {
        if (confirm('Are you sure you want to delete this employee?')) {
            this.employees = this.employees.filter(e => e.id !== employeeId);
            this.lockedEmployees.delete(employeeId);
            this.saveData();
            this.renderEmployees();
            this.renderSchedule();
            this.showToast('Employee deleted successfully');
        }
    }

    renderRequests() {
        const list = document.getElementById('requests-list');
        const filter = document.getElementById('request-filter').value;
        
        let requests = this.requests;
        if (filter !== 'all') {
            requests = requests.filter(r => r.status === filter);
        }

        list.innerHTML = '';

        requests.forEach(request => {
            const employee = this.employees.find(e => e.id === request.employeeId);
            const card = document.createElement('div');
            card.className = 'request-card';

            const startDate = new Date(request.startDate).toLocaleDateString();
            const endDate = new Date(request.endDate).toLocaleDateString();

            card.innerHTML = `
                <div class="request-card-info">
                    <div class="request-card-title">${employee?.name || 'Unknown'} - ${request.type.replace('_', ' ').toUpperCase()}</div>
                    <div class="request-card-details">
                        <span>${startDate} to ${endDate}</span>
                        <span>${request.details}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="request-card-status ${request.status}">${request.status.toUpperCase()}</span>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="app.openRequestModal('${request.id}')">Edit</button>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="app.deleteRequest('${request.id}')">Delete</button>
                </div>
            `;

            list.appendChild(card);
        });

        if (requests.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No requests found.</p>';
        }
    }

    deleteRequest(requestId) {
        if (confirm('Are you sure you want to delete this request?')) {
            this.requests = this.requests.filter(r => r.id !== requestId);
            this.saveData();
            this.renderRequests();
            this.showToast('Request deleted successfully');
        }
    }

    updateDashboard() {
        const monthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
        const monthSchedule = this.schedule[monthKey] || {};

        const stats = this.calculateStatistics(monthSchedule);
        
        document.getElementById('metric-fairness').textContent = stats.fairness.toFixed(1) + '%';
        document.getElementById('fairness-fill').style.width = stats.fairness + '%';
        
        document.getElementById('metric-coverage').textContent = stats.coverage.toFixed(1) + '%';
        document.getElementById('coverage-fill').style.width = stats.coverage + '%';
        
        document.getElementById('metric-fatigue').textContent = stats.fatigue.toFixed(1) + '%';
        document.getElementById('fatigue-fill').style.width = (100 - stats.fatigue) + '%';
        
        document.getElementById('metric-weekend').textContent = stats.weekendBalance.toFixed(1) + '%';
        document.getElementById('weekend-fill').style.width = stats.weekendBalance + '%';
        
        document.getElementById('metric-night').textContent = stats.nightBalance.toFixed(1) + '%';
        document.getElementById('night-fill').style.width = stats.nightBalance + '%';

        this.updateWarnings(stats);
        this.updateStatsTable(monthSchedule);
    }

    calculateStatistics(monthSchedule) {
        const activeEmployees = this.employees.filter(e => e.status === 'active');
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        let totalShifts = 0;
        let totalCoverage = 0;
        let fairnessDeviations = [];
        let nightBalances = [];
        let weekendBalances = [];

        activeEmployees.forEach(emp => {
            const empSchedule = monthSchedule[emp.id] || {};
            let shifts = { M: 0, E: 0, N: 0, OFF: 0, AL: 0, CL: 0 };
            let consecutiveNights = 0;
            let maxConsecutiveNights = 0;
            let nightCount = 0;
            let weekendOFFs = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = String(day).padStart(2, '0');
                const shift = empSchedule[dateStr] || 'OFF';
                shifts[shift]++;
                totalShifts++;

                if (shift !== 'OFF') {
                    totalCoverage++;
                }

                if (shift === 'N') {
                    consecutiveNights++;
                    nightCount++;
                    maxConsecutiveNights = Math.max(maxConsecutiveNights, consecutiveNights);
                } else {
                    consecutiveNights = 0;
                }

                const date = new Date(this.currentYear, this.currentMonth, day);
                const dayOfWeek = date.getDay();
                if ((dayOfWeek === 5 || dayOfWeek === 6) && shift === 'OFF') {
                    weekendOFFs++;
                }
            }

            fairnessDeviations.push(Math.abs((shifts.M + shifts.E + shifts.N) / daysInMonth - 0.5));
            nightBalances.push((nightCount / daysInMonth) * 100);
            weekendBalances.push((weekendOFFs / 8) * 100);
        });

        const fairness = Math.max(0, 100 - (fairnessDeviations.reduce((a, b) => a + b, 0) / fairnessDeviations.length) * 200);
        const coverage = (totalCoverage / totalShifts) * 100;
        const fatigue = Math.min(100, (nightBalances.reduce((a, b) => a + b, 0) / nightBalances.length) * 2);
        const weekendBalance = weekendBalances.reduce((a, b) => a + b, 0) / weekendBalances.length;
        const nightBalance = 100 - (nightBalances.reduce((a, b) => a + b, 0) / nightBalances.length);

        return { fairness, coverage, fatigue, weekendBalance, nightBalance };
    }

    updateWarnings(stats) {
        const warningsList = document.getElementById('warnings-list');
        const warnings = [];

        if (stats.fairness < 60) {
            warnings.push({
                icon: '⚠️',
                title: 'Low Fairness Score',
                text: `Current fairness is ${stats.fairness.toFixed(1)}%. Consider using AI generation to improve distribution.`
            });
        }

        if (stats.coverage < this.settings.minCoverage) {
            warnings.push({
                icon: '🚨',
                title: 'Insufficient Coverage',
                text: `Coverage is ${stats.coverage.toFixed(1)}%. Minimum required is ${this.settings.minCoverage}%.`
            });
        }

        if (stats.fatigue > 70) {
            warnings.push({
                icon: '😴',
                title: 'High Fatigue Risk',
                text: 'Too many night shifts assigned. Consider rebalancing to improve employee health.'
            });
        }

        warningsList.innerHTML = warnings.map(w => `
            <div class="warning-item">
                <div class="warning-icon">${w.icon}</div>
                <div class="warning-content">
                    <div class="warning-title">${w.title}</div>
                    <div class="warning-text">${w.text}</div>
                </div>
            </div>
        `).join('');

        if (warnings.length === 0) {
            warningsList.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">✅ No scheduling issues detected</div>';
        }
    }

    updateStatsTable(monthSchedule) {
        const tbody = document.getElementById('stats-body');
        const activeEmployees = this.employees.filter(e => e.status === 'active');
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        tbody.innerHTML = activeEmployees.map(emp => {
            const empSchedule = monthSchedule[emp.id] || {};
            let shifts = { M: 0, E: 0, N: 0, OFF: 0, AL: 0, CL: 0 };
            let maxConsecutiveNights = 0;
            let consecutiveNights = 0;
            let doubleWeekends = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = String(day).padStart(2, '0');
                const shift = empSchedule[dateStr] || 'OFF';
                shifts[shift]++;

                if (shift === 'N') {
                    consecutiveNights++;
                    maxConsecutiveNights = Math.max(maxConsecutiveNights, consecutiveNights);
                } else {
                    consecutiveNights = 0;
                }
            }

            for (let day = 1; day < daysInMonth; day++) {
                const dateStr1 = String(day).padStart(2, '0');
                const dateStr2 = String(day + 1).padStart(2, '0');
                const shift1 = empSchedule[dateStr1] || 'OFF';
                const shift2 = empSchedule[dateStr2] || 'OFF';

                const date1 = new Date(this.currentYear, this.currentMonth, day);
                const date2 = new Date(this.currentYear, this.currentMonth, day + 1);

                if ((date1.getDay() === 5 && date2.getDay() === 6) && shift1 === 'OFF' && shift2 === 'OFF') {
                    doubleWeekends++;
                }
            }

            return `
                <tr>
                    <td>${emp.name}</td>
                    <td>${shifts.M}</td>
                    <td>${shifts.E}</td>
                    <td>${shifts.N}</td>
                    <td>${shifts.OFF}</td>
                    <td>${shifts.AL}</td>
                    <td>${shifts.CL}</td>
                    <td>${maxConsecutiveNights}</td>
                    <td>${doubleWeekends}</td>
                </tr>
            `;
        }).join('');
    }

    openAISimulation() {
        this.openModal('ai-simulation-modal');
        this.runAISimulation();
    }

    runAISimulation() {
        const progressFill = document.getElementById('simulation-progress');
        const progressText = document.getElementById('simulation-text');
        const resultsList = document.getElementById('results-list');
        const simulationResults = document.getElementById('simulation-results');

        progressText.textContent = 'Generating schedules...';
        resultsList.innerHTML = '';
        simulationResults.style.display = 'none';

        const numSimulations = this.settings.simulations;
        const schedules = [];

        for (let i = 0; i < numSimulations; i++) {
            const schedule = this.generateRandomSchedule();
            const score = this.scoreSchedule(schedule);
            schedules.push({ schedule, score, index: i });

            progressFill.style.width = ((i + 1) / numSimulations * 100) + '%';
            progressText.textContent = `Generated ${i + 1}/${numSimulations} schedules...`;
        }

        schedules.sort((a, b) => b.score - a.score);
        const topSchedules = schedules.slice(0, 5);

        resultsList.innerHTML = topSchedules.map((s, idx) => {
            const stats = this.calculateStatistics(s.schedule);
            return `
                <div class="result-item" onclick="app.selectSchedule(${idx}, '${JSON.stringify(s.schedule).replace(/'/g, '&apos;')}')">
                    <div class="result-item-score">Schedule #${idx + 1} - Score: ${s.score.toFixed(2)}</div>
                    <div class="result-item-details">
                        Fairness: ${stats.fairness.toFixed(1)}% | Coverage: ${stats.coverage.toFixed(1)}% | Weekend Balance: ${stats.weekendBalance.toFixed(1)}%
                    </div>
                </div>
            `;
        }).join('');

        simulationResults.style.display = 'block';
        document.getElementById('ai-simulation-apply').disabled = false;
        progressText.textContent = `Best schedule found with score ${topSchedules[0].score.toFixed(2)}!`;
    }

    generateRandomSchedule() {
        const monthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
        const activeEmployees = this.employees.filter(e => e.status === 'active');
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const schedule = {};

        activeEmployees.forEach(emp => {
            schedule[emp.id] = {};
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = String(day).padStart(2, '0');
                const cellKey = `${monthKey}-${emp.id}-${dateStr}`;

                if (this.lockedCells.has(cellKey)) {
                    schedule[emp.id][dateStr] = (this.schedule[monthKey][emp.id] || {})[dateStr] || 'OFF';
                } else {
                    const shifts = emp.shifts || ['M', 'E', 'N', 'OFF'];
                    schedule[emp.id][dateStr] = shifts[Math.floor(Math.random() * shifts.length)];
                }
            }
        });

        return schedule;
    }

    scoreSchedule(schedule) {
        const stats = this.calculateStatistics(schedule);
        
        const fairnessScore = stats.fairness * (this.settings.weightFairness / 100);
        const coverageScore = Math.min(stats.coverage, 100) * (this.settings.weightCoverage / 100);
        const fatigueScore = (100 - stats.fatigue) * (this.settings.weightFatigue / 100);
        const balanceScore = ((stats.weekendBalance + stats.nightBalance) / 2) * (this.settings.weightBalance / 100);

        return fairnessScore + coverageScore + fatigueScore + balanceScore;
    }

    selectSchedule(index, scheduleJson) {
        this.selectedSchedule = JSON.parse(scheduleJson);
        this.showToast('Schedule selected. Click "Apply Best Schedule" to confirm.');
    }

    applyBestSchedule() {
        if (this.selectedSchedule) {
            const monthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
            this.schedule[monthKey] = this.selectedSchedule;
            this.saveData();
            this.renderSchedule();
            this.updateDashboard();
            this.closeAllModals();
            this.showToast('AI-generated schedule applied successfully');
        }
    }

    autoBalance() {
        const monthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
        const activeEmployees = this.employees.filter(e => e.status === 'active');
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        activeEmployees.forEach(emp => {
            if (this.lockedEmployees.has(emp.id)) return;

            if (!this.schedule[monthKey][emp.id]) {
                this.schedule[monthKey][emp.id] = {};
            }

            let shiftCounts = { M: 0, E: 0, N: 0, OFF: 0 };
            const cellChanges = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = String(day).padStart(2, '0');
                const cellKey = `${monthKey}-${emp.id}-${dateStr}`;
                const shift = this.schedule[monthKey][emp.id][dateStr] || 'OFF';
                shiftCounts[shift]++;
            }

            const targetPerShift = daysInMonth / 4;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = String(day).padStart(2, '0');
                const cellKey = `${monthKey}-${emp.id}-${dateStr}`;

                if (this.lockedCells.has(cellKey)) continue;

                const shift = this.schedule[monthKey][emp.id][dateStr] || 'OFF';
                const excessShift = Object.keys(shiftCounts).find(s => shiftCounts[s] > targetPerShift);

                if (excessShift && shift === excessShift) {
                    const deficitShift = Object.keys(shiftCounts).find(s => shiftCounts[s] < targetPerShift);
                    if (deficitShift && emp.shifts.includes(deficitShift)) {
                        shiftCounts[shift]--;
                        shiftCounts[deficitShift]++;
                        this.schedule[monthKey][emp.id][dateStr] = deficitShift;
                    }
                }
            }
        });

        this.saveData();
        this.renderSchedule();
        this.updateDashboard();
        this.showToast('Auto-rebalance completed');
    }

    exportToExcel() {
        const monthKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
        const monthSchedule = this.schedule[monthKey] || {};
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        let csv = 'Employee,Position,' + Array.from({length: daysInMonth}, (_, i) => i + 1).join(',') + '\n';

        this.employees.filter(e => e.status === 'active').forEach(emp => {
            const empSchedule = monthSchedule[emp.id] || {};
            const row = [emp.name, emp.position];
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = String(day).padStart(2, '0');
                row.push(empSchedule[dateStr] || 'OFF');
            }
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schedule_${monthKey}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.showToast('Schedule exported to CSV');
    }

    createBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            data: {
                employees: this.employees,
                schedule: this.schedule,
                requests: this.requests,
                settings: this.settings
            }
        };

        this.backupHistory.push(backup);
        if (this.backupHistory.length > 10) {
            this.backupHistory.shift();
        }

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scheduler_backup_${backup.timestamp.replace(/[:.]/g, '-')}.json`;
        a.click();
        window.URL.revokeObjectURL(url);

        this.saveData();
        this.renderBackupHistory();
        this.showToast('Backup created successfully');
    }

    restoreBackup() {
        const fileInput = document.getElementById('restore-file');
        const file = fileInput.files[0];

        if (!file) {
            this.showToast('Please select a backup file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target.result);
                this.employees = backup.data.employees;
                this.schedule = backup.data.schedule;
                this.requests = backup.data.requests;
                this.settings = backup.data.settings;
                this.saveData();
                this.renderSchedule();
                this.renderEmployees();
                this.renderRequests();
                this.updateDashboard();
                this.closeAllModals();
                this.showToast('Backup restored successfully');
            } catch (error) {
                this.showToast('Failed to restore backup', 'error');
            }
        };
        reader.readAsText(file);
    }

    renderBackupHistory() {
        const history = document.getElementById('backup-history');
        history.innerHTML = this.backupHistory.map((b, idx) => `
            <div class="backup-item">
                <span>${new Date(b.timestamp).toLocaleString()}</span>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="app.restoreFromHistory(${idx})">Restore</button>
            </div>
        `).join('');
    }

    restoreFromHistory(index) {
        if (confirm('Are you sure you want to restore this backup?')) {
            const backup = this.backupHistory[index];
            this.employees = backup.data.employees;
            this.schedule = backup.data.schedule;
            this.requests = backup.data.requests;
            this.settings = backup.data.settings;
            this.saveData();
            this.renderSchedule();
            this.renderEmployees();
            this.renderRequests();
            this.updateDashboard();
            this.showToast('Restored from backup');
        }
    }

    openBackupModal() {
        this.renderBackupHistory();
        this.openModal('backup-modal');
    }

    clearCache() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            localStorage.clear();
            location.reload();
        }
    }

    updateSettings() {
        this.settings.defaultMonth = document.getElementById('setting-default-month').value;
        this.settings.autosaveInterval = parseInt(document.getElementById('setting-autosave').value);
        this.settings.minCoverage = parseInt(document.getElementById('setting-min-coverage').value);
        this.settings.maxConsecutiveNights = parseInt(document.getElementById('setting-max-consecutive-nights').value);
        this.settings.maxNightPerWeek = parseInt(document.getElementById('setting-max-night-per-week').value);
        this.settings.simulations = parseInt(document.getElementById('setting-simulations').value);
        this.settings.weightFairness = parseInt(document.getElementById('setting-weight-fairness').value);
        this.settings.weightCoverage = parseInt(document.getElementById('setting-weight-coverage').value);
        this.settings.weightFatigue = parseInt(document.getElementById('setting-weight-fatigue').value);
        this.settings.weightBalance = parseInt(document.getElementById('setting-weight-balance').value);
        this.saveSettings();
        this.showToast('Settings updated');
    }

    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            this.saveData();
        }, this.settings.autosaveInterval * 1000);
    }

    saveToHistory() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push({
            employees: JSON.parse(JSON.stringify(this.employees)),
            schedule: JSON.parse(JSON.stringify(this.schedule)),
            requests: JSON.parse(JSON.stringify(this.requests))
        });

        if (this.history.length > 50) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.employees = JSON.parse(JSON.stringify(state.employees));
            this.schedule = JSON.parse(JSON.stringify(state.schedule));
            this.requests = JSON.parse(JSON.stringify(state.requests));
            this.renderSchedule();
            this.renderEmployees();
            this.renderRequests();
            this.updateDashboard();
            this.updateUndoRedoButtons();
            this.showToast('Undo applied');
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.employees = JSON.parse(JSON.stringify(state.employees));
            this.schedule = JSON.parse(JSON.stringify(state.schedule));
            this.requests = JSON.parse(JSON.stringify(state.requests));
            this.renderSchedule();
            this.renderEmployees();
            this.renderRequests();
            this.updateDashboard();
            this.updateUndoRedoButtons();
            this.showToast('Redo applied');
        }
    }

    updateUndoRedoButtons() {
        document.getElementById('undo-btn').disabled = this.historyIndex <= 0;
        document.getElementById('redo-btn').disabled = this.historyIndex >= this.history.length - 1;
    }

    previousMonth() {
        if (this.currentMonth === 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else {
            this.currentMonth--;
        }
        document.getElementById('month-selector').value = this.currentMonth;
        document.getElementById('year-selector').value = this.currentYear;
        this.renderSchedule();
    }

    nextMonth() {
        if (this.currentMonth === 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else {
            this.currentMonth++;
        }
        document.getElementById('month-selector').value = this.currentMonth;
        document.getElementById('year-selector').value = this.currentYear;
        this.renderSchedule();
    }

    filterSchedule() {
        const searchTerm = document.getElementById('employee-search').value.toLowerCase();
        const rows = document.querySelectorAll('#schedule-body tr');

        rows.forEach(row => {
            const empName = row.querySelector('.employee-cell').textContent.toLowerCase();
            row.style.display = empName.includes(searchTerm) ? '' : 'none';
        });
    }

    filterEmployees() {
        const searchTerm = document.getElementById('employees-search').value.toLowerCase();
        const cards = document.querySelectorAll('.employee-card');

        cards.forEach(card => {
            const empName = card.querySelector('.employee-card-title').textContent.toLowerCase();
            card.style.display = empName.includes(searchTerm) ? '' : 'none';
        });
    }

    openModal(modalId) {
        document.getElementById('modal-overlay').classList.add('active');
        document.getElementById(modalId).classList.add('active');
    }

    closeAllModals() {
        document.getElementById('modal-overlay').classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const content = document.getElementById('toast-content');
        content.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SchedulerApp();
    console.log('Enterprise AI Duty Scheduler V4 initialized');
});
