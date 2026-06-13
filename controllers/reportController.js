const ExcelJS = require('exceljs');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const User = require('../models/User');
const Subject = require('../models/Subject');

const GREEN = 'FF1A6B4A';
const headerStyle = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
};
const applyBorder = (cell) => {
  cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
};

// @GET /api/reports/subject/:subjectId
exports.subjectReport = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId)
      .populate('departmentId', 'name code')
      .populate('teacherId', 'name');
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    // ✅ Authorization: teacher শুধু নিজের subject-এর report নিতে পারবে
    if (req.user.role === 'teacher' && subject.teacherId?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'এটা আপনার subject নয়' });
    }

    const sessions = await Session.find({ subjectId: subject._id, status: 'ended' }).sort({ date: 1 });

    // ✅ Shift filter যোগ
    const studentFilter = {
      role: 'student', departmentId: subject.departmentId._id,
      semester: subject.semester, section: subject.section, isActive: true
    };
    if (subject.shift) studentFilter.shift = subject.shift;

    const students = await User.find(studentFilter).sort({ name: 1 });

    const allAtt = await Attendance.find({ subjectId: subject._id });
    const attMap = {};
    allAtt.forEach(a => {
      const sid = a.studentId.toString();
      if (!attMap[sid]) attMap[sid] = {};
      attMap[sid][a.sessionId.toString()] = a.status;
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PolyAttend';
    const ws = wb.addWorksheet('Attendance Report');

    const totalCols = 7 + sessions.length;
    ws.mergeCells(1, 1, 1, totalCols);
    const title = ws.getCell('A1');
    title.value = `ATTENDANCE REPORT - ${subject.departmentId.name}`;
    title.font = { bold: true, size: 14, color: { argb: GREEN } };
    title.alignment = { horizontal: 'center' };
    ws.getRow(1).height = 22;

    ws.mergeCells(2, 1, 2, totalCols);
    ws.getCell('A2').value = `Subject: ${subject.name} (${subject.code}) | Semester: ${subject.semester} | Section: ${subject.section} | Shift: ${subject.shift || 'N/A'} | Teacher: ${subject.teacherId?.name || 'N/A'}`;
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.getRow(2).font = { size: 10, italic: true };

    ws.addRow([]);

    const baseHeaders = ['#', 'Student ID', 'Student Name', 'Department', 'Semester', 'Section'];
    const dateHeaders = sessions.map(s => new Date(s.date).toLocaleDateString('en-BD', { day: '2-digit', month: 'short' }));
    const summaryHeaders = ['Total', 'Present', 'Absent', 'Percentage'];
    const headerRow = ws.addRow([...baseHeaders, ...dateHeaders, ...summaryHeaders]);
    headerRow.eachCell(cell => Object.assign(cell, headerStyle));
    ws.getRow(4).height = 18;

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 22;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 10;
    for (let i = 0; i < sessions.length; i++) ws.getColumn(7 + i).width = 10;
    ws.getColumn(7 + sessions.length).width = 8;
    ws.getColumn(8 + sessions.length).width = 10;
    ws.getColumn(9 + sessions.length).width = 10;
    ws.getColumn(10 + sessions.length).width = 12;

    students.forEach((student, idx) => {
      const sid = student._id.toString();
      const recs = attMap[sid] || {};
      const total = sessions.length;
      const present = sessions.filter(s => recs[s._id.toString()] === 'present').length;
      const absent = total - present;
      const pct = total ? Math.round((present / total) * 100) : 0;

      const dateStatuses = sessions.map(s => {
        const st = recs[s._id.toString()];
        return st === 'present' ? 'P' : st === 'absent' ? 'A' : '-';
      });

      const row = ws.addRow([
        idx + 1, student.studentId, student.name,
        subject.departmentId.name, subject.semester, subject.section,
        ...dateStatuses, total, present, absent, `${pct}%`
      ]);

      row.eachCell(cell => applyBorder(cell));

      dateStatuses.forEach((st, i) => {
        const cell = row.getCell(7 + i);
        if (st === 'P') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          cell.font = { color: { argb: 'FF065F46' }, bold: true };
        } else if (st === 'A') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          cell.font = { color: { argb: 'FF991B1B' }, bold: true };
        }
      });

      const pctCell = row.getCell(10 + sessions.length);
      if (pct >= 75) pctCell.font = { color: { argb: 'FF065F46' }, bold: true };
      else if (pct >= 60) pctCell.font = { color: { argb: 'FF92400E' }, bold: true };
      else pctCell.font = { color: { argb: 'FF991B1B' }, bold: true };
    });

    ws.addRow([]);
    const sumRow = ws.addRow(['', '', `Total Students: ${students.length}`, '', '', '',
      ...sessions.map(() => ''), sessions.length, '', '', '']);
    sumRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="subject_${subject.code}_report.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @GET /api/reports/student/:studentId
exports.studentReport = async (req, res) => {
  try {
    const student = await User.findById(req.params.studentId).populate('departmentId', 'name code');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // ✅ Student শুধু নিজেরটা, teacher/admin সব
    if (req.user.role === 'student' && req.user._id.toString() !== req.params.studentId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const records = await Attendance.find({ studentId: student._id })
      .populate('subjectId', 'name code')
      .populate('sessionId', 'date')
      .sort({ date: -1 });

    const bySubject = {};
    records.forEach(r => {
      const sid = r.subjectId?._id?.toString();
      if (!sid) return;
      if (!bySubject[sid]) bySubject[sid] = { subject: r.subjectId, total: 0, present: 0, absent: 0, records: [] };
      bySubject[sid].total++;
      bySubject[sid][r.status]++;
      bySubject[sid].records.push(r);
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PolyAttend';
    const ws = wb.addWorksheet('My Attendance');

    ws.mergeCells('A1:G1');
    ws.getCell('A1').value = 'PERSONAL ATTENDANCE REPORT';
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: GREEN } };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:G2');
    ws.getCell('A2').value = `Student: ${student.name} | ID: ${student.studentId} | Dept: ${student.departmentId?.name} | Semester: ${student.semester} | Section: ${student.section} | Shift: ${student.shift || 'N/A'}`;
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.getRow(2).font = { size: 10, italic: true };

    ws.addRow([]);
    const hRow = ws.addRow(['Subject Name', 'Subject Code', 'Total Classes', 'Present', 'Absent', 'Percentage', 'Status']);
    hRow.eachCell(cell => Object.assign(cell, headerStyle));
    ws.columns = [
      { key: 'name', width: 24 }, { key: 'code', width: 14 },
      { key: 'total', width: 14 }, { key: 'present', width: 12 },
      { key: 'absent', width: 12 }, { key: 'pct', width: 14 }, { key: 'status', width: 12 }
    ];

    let overallTotal = 0, overallPresent = 0;
    Object.values(bySubject).forEach(s => {
      const pct = s.total ? Math.round((s.present / s.total) * 100) : 0;
      overallTotal += s.total; overallPresent += s.present;
      const row = ws.addRow([s.subject.name, s.subject.code, s.total, s.present, s.absent, `${pct}%`,
      pct >= 75 ? 'Good' : pct >= 60 ? 'Warning' : 'Critical']);
      row.eachCell(cell => applyBorder(cell));
      const pctCell = row.getCell(6);
      if (pct >= 75) { pctCell.font = { color: { argb: 'FF065F46' }, bold: true }; row.getCell(7).font = { color: { argb: 'FF065F46' }, bold: true }; }
      else if (pct >= 60) { pctCell.font = { color: { argb: 'FF92400E' }, bold: true }; row.getCell(7).font = { color: { argb: 'FF92400E' }, bold: true }; }
      else { pctCell.font = { color: { argb: 'FF991B1B' }, bold: true }; row.getCell(7).font = { color: { argb: 'FF991B1B' }, bold: true }; }
    });

    ws.addRow([]);
    const overallPct = overallTotal ? Math.round((overallPresent / overallTotal) * 100) : 0;
    const totRow = ws.addRow(['OVERALL', '', overallTotal, overallPresent, overallTotal - overallPresent, `${overallPct}%`, '']);
    totRow.font = { bold: true };
    totRow.eachCell(cell => applyBorder(cell));

    const ws2 = wb.addWorksheet('Date-wise Records');
    const h2 = ws2.addRow(['Date', 'Subject', 'Subject Code', 'Status']);
    h2.eachCell(cell => Object.assign(cell, headerStyle));
    ws2.columns = [{ width: 16 }, { width: 24 }, { width: 14 }, { width: 12 }];
    records.forEach(r => {
      const row = ws2.addRow([
        new Date(r.date).toLocaleDateString('en-BD'),
        r.subjectId?.name || '-', r.subjectId?.code || '-', r.status
      ]);
      row.eachCell(cell => applyBorder(cell));
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.status === 'present' ? 'FFD1FAE5' : 'FFFEE2E2' } };
      row.getCell(4).font = { color: { argb: r.status === 'present' ? 'FF065F46' : 'FF991B1B' }, bold: true };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="student_${student.studentId}_report.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @GET /api/reports/class/:sessionId
exports.classReport = async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('departmentId', 'name code')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    // ✅ Authorization: teacher শুধু নিজের session-এর report নিতে পারবে
    if (req.user.role === 'teacher' && session.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'এটা আপনার session নয়' });
    }

    const attendance = await Attendance.find({ sessionId: session._id })
      .populate('studentId', 'name studentId section');

    // ✅ Shift filter যোগ
    const studentFilter = {
      role: 'student', departmentId: session.departmentId._id,
      semester: session.semester, section: session.section, isActive: true
    };
    if (session.shift) studentFilter.shift = session.shift;

    const allStudents = await User.find(studentFilter).sort({ studentId: 1 });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attendance');

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `${session.departmentId.name} - Attendance Sheet`;
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: GREEN } };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.mergeCells('A2:F2');
    ws.getCell('A2').value = `Subject: ${session.subjectId.name} | Semester: ${session.semester} | Section: ${session.section} | Shift: ${session.shift || 'N/A'} | Date: ${new Date(session.date).toLocaleDateString('en-BD')} | Teacher: ${session.teacherId.name}`;
    ws.getCell('A2').alignment = { horizontal: 'center' };

    ws.addRow([]);
    const headerRow = ws.addRow(['#', 'Student ID', 'Student Name', 'Section', 'Status', 'Scan Time']);
    headerRow.eachCell(cell => Object.assign(cell, headerStyle));
    ws.columns = [{ width: 6 }, { width: 14 }, { width: 24 }, { width: 10 }, { width: 12 }, { width: 16 }];

    const presentMap = {};
    attendance.forEach(a => { presentMap[a.studentId._id.toString()] = a; });

    allStudents.forEach((student, i) => {
      const rec = presentMap[student._id.toString()];
      const isPresent = !!rec && rec.status === 'present';
      const row = ws.addRow([
        i + 1, student.studentId, student.name, student.section,
        isPresent ? 'Present' : 'Absent',
        rec?.scannedAt ? new Date(rec.scannedAt).toLocaleTimeString() : '-'
      ]);
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isPresent ? 'FFD1FAE5' : 'FFFEE2E2' } };
      row.getCell(5).font = { color: { argb: isPresent ? 'FF065F46' : 'FF991B1B' }, bold: true };
      row.eachCell(cell => applyBorder(cell));
    });

    const presentCount = Object.values(presentMap).filter(a => a.status === 'present').length;
    ws.addRow([]);
    ws.addRow(['', '', '', 'Total', allStudents.length, '']).font = { bold: true };
    ws.addRow(['', '', '', 'Present', presentCount, '']).font = { bold: true, color: { argb: 'FF065F46' } };
    ws.addRow(['', '', '', 'Absent', allStudents.length - presentCount, '']).font = { bold: true, color: { argb: 'FF991B1B' } };
    ws.addRow(['', '', '', 'Percentage', `${allStudents.length ? Math.round(presentCount / allStudents.length * 100) : 0}%`, '']).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="session_${req.params.sessionId}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};