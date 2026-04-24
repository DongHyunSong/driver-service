const nodemailer = require('nodemailer');

// 환경변수를 사용하여 SMTP 트랜스포터 구성 (Gmail 권장)
// GCP 환경에서 포트 465(보안) 또는 587을 사용합니다.
const transporter = nodemailer.createTransport({
  service: 'gmail', // GCP에서 Gmail SMTP(Google Workspace) 사용이 일반적입니다
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

/**
 * 드라이버 출퇴근 시 고용주에게 이메일 알림 발송
 * @param {Object} employer 고용주 객체
 * @param {Object} driver 드라이버 객체
 * @param {Object} record 출퇴근 기록 객체
 * @param {String} action 'checkin' | 'checkout' | 'manual'
 */
async function sendAttendanceEmail(employer, driver, record, action) {
  if (!employer.email) {
    console.log(`[Email] 고용주(${employer.name})의 이메일이 등록되어 있지 않습니다.`);
    return;
  }

  // 이메일 설정이 되어있지 않으면 스킵 (개발 환경 테스트용)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[Email] 환경변수(EMAIL_USER, EMAIL_PASS)가 설정되어 있지 않아 이메일 발송을 스킵합니다. (대상: ${employer.email})`);
    return;
  }

  const timeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' };
  
  let subject = '';
  let content = '';

  if (action === 'checkin') {
    subject = `[Driver Payment] ${driver.name} 드라이버가 출근했습니다.`;
    const inTime = new Date(record.clockIn).toLocaleTimeString('ko-KR', timeFormatOptions);
    content = `
      <h3>출근 알림</h3>
      <p><strong>드라이버:</strong> ${driver.name}</p>
      <p><strong>날짜:</strong> ${record.date}</p>
      <p><strong>출근 시간:</strong> ${inTime}</p>
      <hr>
      <p>본 메일은 Driver Payment 시스템에서 자동 발송되었습니다.</p>
    `;
  } else if (action === 'checkout') {
    subject = `[Driver Payment] ${driver.name} 드라이버가 퇴근했습니다.`;
    const inTime = new Date(record.clockIn).toLocaleTimeString('ko-KR', timeFormatOptions);
    const outTime = new Date(record.clockOut).toLocaleTimeString('ko-KR', timeFormatOptions);
    content = `
      <h3>퇴근 알림</h3>
      <p><strong>드라이버:</strong> ${driver.name}</p>
      <p><strong>날짜:</strong> ${record.date}</p>
      <p><strong>출근 시간:</strong> ${inTime}</p>
      <p><strong>퇴근 시간:</strong> ${outTime}</p>
      <p><strong>총 근무시간:</strong> ${record.hoursWorked} 시간 (OT: ${record.otHours} 시간)</p>
      <hr>
      <p>본 메일은 Driver Payment 시스템에서 자동 발송되었습니다.</p>
    `;
  } else if (action === 'manual') {
    subject = `[Driver Payment] ${driver.name} 드라이버의 출퇴근 기록이 수동으로 등록/수정되었습니다.`;
    content = `
      <h3>근무 기록 수동 등록/수정 알림</h3>
      <p><strong>드라이버:</strong> ${driver.name}</p>
      <p><strong>날짜:</strong> ${record.date}</p>
      <p><strong>총 근무시간:</strong> ${record.hoursWorked} 시간 (OT: ${record.otHours} 시간)</p>
      <p><strong>메모:</strong> ${record.note || '없음'}</p>
      <hr>
      <p>본 메일은 Driver Payment 시스템에서 자동 발송되었습니다.</p>
    `;
  } else {
    return;
  }

  const mailOptions = {
    from: `"Driver Payment System" <${process.env.EMAIL_USER || 'no-reply@driverpayment.com'}>`,
    to: employer.email,
    subject: subject,
    html: content
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] 메일 발송 성공: ${info.messageId}`);
  } catch (error) {
    console.error('[Email] 메일 발송 실패:', error);
  }
}

module.exports = { sendAttendanceEmail };
