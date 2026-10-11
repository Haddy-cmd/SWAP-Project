# DIGITAL MONITORING AND APPLICATION SYSTEM FOR STUDENT WELFARE ASSISTANTSHIP PROGRAM IN MSU MARAWI

*Revised Chapters 1–3, aligned with the developed system. Figures marked “Insert figure” keep the original image or are rendered from the Mermaid files in `figures/`.*

## CHAPTER 1: INTRODUCTION

Manual record-keeping practices in higher education, such as paper-based files and the manual tracking of student information, often result in inefficiency, a higher risk of data loss, limited accessibility and reduced administrative performance. Moving from these manual processes to digital, web-based record systems has been shown to improve the accuracy, security, transparency and timeliness of access to student data. Empirical findings indicate that such digital transformation can raise staff productivity, increase student satisfaction and strengthen compliance with institutional and regulatory requirements, which underscores the need to modernize record management in student support programs [1].

Mindanao State University – Main Campus established the Student Welfare Assistantship Program (SWAP) under the Division of Student Affairs (DSA) to provide financial assistance to deserving students in financial need. In return, recipients serve as student assistants in offices across the university, where they gain work experience and the chance to apply their skills while they study.

Despite its good intentions, SWAP still relies mostly on manual, paper-based processes for managing records and monitoring recipients. Submitting requirements, scheduling interviews, recording duty hours on paper duty slips that a coordinator signs, and computing each recipient’s hours at the end of the semester are all done by hand. This results in slow record retrieval, inaccurate time tracking and a greater risk of lost documents, which affect both efficiency and transparency. Studies have shown that manual record-keeping in academic environments often leads to inefficiency, errors and security risks, and becomes a barrier to effective student support and data integrity [2].

To address these challenges, this capstone project develops the “Digital Monitoring and Application System for the Student Welfare Assistantship Program in MSU Marawi,” a web-based system deployed as the *SWAP Portal*. The system moves the whole SWAP cycle online: application and interview, office assignment, QR-code and location-verified duty attendance, supervisor verification of hours, end-of-term reporting, renewal, and the release of the semester stipend with an electronically signed stub. By digitizing these processes, the office improves the accuracy, accessibility and security of student records, and gains administrative efficiency, compliance and long-term sustainability.

The project aims to benefit both the office staff and the students: it improves program management, gives students convenience and transparency, and aligns the program with best practices for efficiency, accessibility and accountability in student support services.

### 1.1 Project Context

This capstone project, entitled “Digital Monitoring and Application System for the Student Welfare Assistantship Program in MSU Marawi,” is a software development project that digitizes the application, monitoring and record-keeping of student recipients under the Student Welfare Assistantship Program (SWAP). The project was conceptualized during the first semester of Academic Year 2025–2026 and is expected to be completed in the second semester of Academic Year 2025–2026.

The project is intended to help the Division of Student Affairs manage applications, office assignments and stipend releases; to help office supervisors verify the service hours of the recipients assigned to them; and to give students a convenient and transparent way to apply and to track their rendered service. These groups are also the respondents of the study. With a system designed around the needs of the office and its clients, administrative tasks are simplified and accountability in the program is strengthened. Through this project, the researchers aim to minimize the inefficiency and the risk of record loss caused by the current paper-based process.

The researchers apply software engineering methodologies to ensure that the system meets the functional requirements of the Division of Student Affairs while maintaining accuracy, security and usability.

### 1.2 Purpose and Description

This project digitizes and improves the application process and the monitoring of student recipients under the Student Welfare Assistantship Program (SWAP). It replaces the manual, paper-based processes currently used by the Division of Student Affairs (DSA) with a more efficient and secure computerized system, and automates error-prone tasks such as the computation of service hours.

The system serves four groups of users. **Student applicants** register with their institutional email, submit their application and requirements online, and track its status. **DSA administrators** review applications, schedule interviews, approve or reject applicants, assign each recipient to a host office and an office supervisor, and release the semester stipend. **Office supervisors** (SWAP mentors) verify or reject the duty logs of the recipients assigned to them and accept their end-of-term reports. **SWAP recipients** clock in and out by scanning their office’s QR code, and monitor their rendered and remaining hours, their pace for the term, their printable duty slips and semester service report, their stipend requirements and their stipend history.

This project is motivated by the lack of a modern, systematic approach both in the application process and during the actual service of SWAP recipients. Service hours are computed manually every semester, and monitoring of recipients is often neglected because they are assigned to different offices across the university. The opportunity lies in using technology to make monitoring proactive: hours are logged at the office itself, verified by the supervisor who sees the work, and summarized automatically for the DSA.

### 1.3 Objectives

This capstone project aims to develop and implement a computerized application and monitoring system that streamlines the application process, tracks rendered service hours, and improves the management and transparency of the Student Welfare Assistantship Program (SWAP).

Specifically, this capstone project aims:

1. To gather and analyze the functional requirements by studying the current manual workflows of SWAP, in order to identify key pain points and necessary features.
2. To design the system architecture, including the database schema and the user interfaces, for the four user roles: Student Applicants, SWAP Recipients, Office Supervisors and DSA Administrators.
3. To develop the system, turning the approved designs into a working web-based application with modules for (a) online application, interview scheduling and renewal; (b) QR-code and geofence-verified duty attendance with supervisor verification; (c) end-of-term reporting and promissory notes; (d) stipend release with an electronically signed stub; and (e) notifications, announcements, a chatbot, reports and analytics.
4. To test the system through Alpha testing (functional test cases and automated tests by the developers) and Beta testing (user testing with the System Usability Scale), in order to detect and fix defects and to confirm that the software meets standards for functionality, security, reliability and usability.

### 1.4 Scope and Limitations

**Scope.** This capstone project covers the design and development of an application and monitoring system for the Student Welfare Assistantship Program of MSU Marawi. The system covers the following:

- **Accounts and security.** Student self-registration with an institutional email (@s.msumain.edu.ph) and a nine-digit student ID, confirmed by a six-digit code sent to that email; sign-in with an optional emailed sign-in code and a 30-day trusted browser; password recovery by email code; staff accounts created by invitation; role-based access for the four roles.
- **Application and renewal.** Online application with uploaded requirements (certificate of registration, grade card, letter of intent and 2×2 photo); review by the DSA; face-to-face or online interview scheduling; approval, which makes the applicant a SWAP recipient; and renewal applications for the next term.
- **Offices and assignments.** Host office management, including each office’s QR code, map location, geofence radius, capacity and automatic clock-out setting; assignment of a recipient to an office, an office supervisor and the required service hours for the term.
- **Duty monitoring.** QR-code clock-in and clock-out with GPS geofence checking and a proof-of-presence selfie; a required Task Description at clock-out; automatic clock-out; supervisor verification of logs; automatic computation of rendered, verified and remaining hours; printable duty slips and a semester service report.
- **End of term.** A semester calendar kept by the DSA; automatic recording of each placement as Qualified or Deficient when the semester ends; an end-of-term narrative report that the supervisor accepts with a renewal-eligibility mark; and one promissory note per semester for a recipient who is short on hours.
- **Stipend.** Determination of stipend eligibility; release of the stipend by the DSA, which produces a stipend stub with a control number signed with the saved electronic signatures; voiding of a stub with a reason; and the recipient’s stipend history.
- **Communication and records.** Email and in-app notifications, announcements, “Ask the DSA” concerns, a chatbot for inquiries about SWAP, reports and analytics per role with PDF and CSV export, and an audit log of key actions.

**Limitations.** The study is limited to the Student Welfare Assistantship Program and does not include other services of the Division of Student Affairs, such as other scholarship programs. The system has the following limitations:

- It requires an internet connection; there is no offline mode.
- Clock-in and clock-out require a smartphone (or another device) with a camera and GPS, with camera and location permission granted to the browser, and the recipient must be physically inside the office geofence.
- Duty can be logged only from Monday to Saturday, between 6:00 AM and 5:30 PM Philippine time.
- Only students with an institutional email address ending in @s.msumain.edu.ph can register.
- Notifications are sent by email and in-app only; the system does not send SMS.
- The system determines stipend eligibility, records the release and generates the signed stipend stub, but the actual cash or bank disbursement and payroll processing remain outside the system.
- The project does not cover hardware acquisition or network infrastructure maintenance.

### 1.5 Significance of the Study

This project contributes a practical solution to the inefficiency of manual record-keeping in the Student Welfare Assistantship Program (SWAP). Through digitization, it improves the accuracy, accountability and transparency of the management of student recipients. It is beneficial to the following:

**Division of Student Affairs (DSA) Staff.** They benefit from streamlined workflows, centralized records, automatic computation of hours, and reduced paperwork, which allows them to focus on more important administrative tasks.

**Office Supervisors (SWAP Mentors).** As the immediate supervisors of the student assistants, they benefit from a digital monitoring tool that lets them verify attendance and accept end-of-term reports online. Digital verification replaces the manual signing of daily time records, and logs made outside the office geofence are flagged, which reduces the risk of falsified hours.

**SWAP Recipients.** They gain clearer monitoring of their hours, timely verification of their service, visibility of what is still needed for their stipend, and a more organized system that supports efficient service.

**Student Applicants.** They benefit from a convenient and accessible platform to submit their requirements and to track the status of their applications.

**The University.** Mindanao State University gains improved integrity and accountability in the SWAP program, reflecting its commitment to student welfare and technological advancement.

**Future Researchers.** The study can serve as a reference for researchers developing monitoring systems for student assistantship, work-study or similar programs.

### 1.6 Definition of Terms

**Announcement** – A message posted by the DSA to all users or to selected roles, optionally with file attachments.

**Assignment (Placement)** – The record that places a SWAP recipient in a host office under an office supervisor for one term, with the required service hours for that term.

**Audit Log** – A record of key actions in the system (who did what, to which record, and when), used for accountability.

**Automatic Clock-Out** – The system’s closing of a duty session when the recipient leaves the office geofence (if the office enables it) or when a session has been open for more than twelve hours.

**Chatbot** – An automated assistant that answers inquiries about SWAP requirements and the application process. It uses a generative AI model (Google Gemini) that answers from the program’s FAQ knowledge base, and falls back to keyword matching when the AI service is unavailable.

**Concern (“Ask the DSA”)** – A question or issue that a student sends to the DSA through the system, answered in a message thread.

**Dashboard** – The first page each user sees after signing in, summarizing the information and pending tasks relevant to their role.

**Digital Monitoring and Application System** – The web-based system developed in this project for the DSA’s SWAP program, deployed as the *SWAP Portal*. It is also referred to as “the system.”

**Division of Student Affairs (DSA)** – The university office responsible for implementing and managing SWAP, including applicant screening, assignment to offices, monitoring of recipients, stipend release and the documentation of program records.

**DSA Administrator** – A DSA staff member with administrator access who manages applications, interviews, offices, assignments, semester periods, stipend releases, announcements and user accounts.

**Duty Slip** – A printable record of a recipient’s verified duty sessions for a week, generated from the time logs.

**Electronic Signature (Signature Specimen)** – An image of a user’s signature saved in their profile, which the system places on the stipend stub.

**Email Verification Code** – A six-digit one-time code sent to the user’s email to confirm a registration, a sign-in or a password reset. It is valid for ten minutes and allows up to five tries.

**End-of-Term Report** – The recipient’s narrative report for the whole term, typed in the system or uploaded as a PDF or Word file. It is required before the stipend can be released, and the office supervisor accepts it with a mark of eligible or not eligible for renewal.

**Geofence** – A virtual circular boundary around a host office, defined by its map location and radius. Clock-in is accepted only inside it.

**Office QR Code** – A Quick Response code assigned to each host office and posted there. The recipient scans it to clock in and to clock out.

**Office Supervisor (SWAP Mentor)** – The staff member in a host office who oversees the recipients assigned there, verifies their duty logs, and accepts their end-of-term reports.

**Promissory Note** – A signed document that a recipient who is short on hours after the semester ends may file, once per semester, promising to render the lacking hours. If the supervisor approves it, the stipend can still be released, and the lacking hours are added to the next term if the student renews.

**Proof-of-Presence Selfie** – A photo taken with the device camera at clock-in to show that the recipient is at the office. Supervisors may switch this requirement off.

**Rendered Service Hours** – The total duty hours a recipient has logged in a term. Only **verified hours**, those confirmed by the office supervisor, count toward the requirement.

**Renewal** – An application by a current recipient to continue in SWAP for the next term.

**Reports and Analytics** – On-demand, filterable reports and charts for each role, which can be downloaded as PDF or CSV.

**Required Service Hours** – The number of verified hours a recipient must render in a term, set at assignment (200 hours by default).

**Semester Period** – A term in the DSA’s semester calendar (academic year, semester, start date and end date) that the system uses for term-based rules.

**Stipend Stub** – The final record of a stipend release, with a control number and a PDF signed with the electronic signatures of the office supervisor, the releasing DSA official and the recipient.

**Student Applicant** – An MSU student who has registered in the system and submits a SWAP application for review.

**Student Welfare Assistantship Program (SWAP)** – A student welfare initiative of the university that assigns qualified students to assist in designated offices in exchange for financial support, subject to the completion of the required service hours.

**SWAP Recipient** – A student whose application has been approved and who renders service hours in an assigned office.

**Task Description** – The short account of the work done in a duty session, required at clock-out. It is printed on the duty slip.

**Term Result** – The status recorded for each placement when its semester ends: **Qualified** if the required hours were met, or **Deficient** with the number of hours short.

**Time-In / Time-Out** – The digital recording of the start and end of a duty session by scanning the office QR code, used as the basis for computing the session’s duration.

**Time Log** – The stored record of one duty session: date, time-in and time-out, GPS location and its accuracy, any location flag, the selfie, the Task Description, the computed duration and the verification status.

**Trusted Browser** – A browser the user chose to remember at sign-in, which skips the emailed sign-in code for 30 days.

**Verification** – The office supervisor’s review of a time log. A log moves from Open (on duty) to Pending Verification (clocked out), then to Verified or Rejected.

## CHAPTER 2: REVIEW OF RELATED LITERATURE

This chapter presents discussions and findings from previous studies relevant to the development of the system. It highlights key concepts such as institutional support for student programs, the use of digital and web-based technologies for monitoring and management, and the benefits of automation in improving efficiency, accuracy and accessibility. The reviewed systems show how modern platforms combine digital tracking, real-time data management and online access to streamline processes and improve transparency. Overall, the literature supports the adoption of technology-driven solutions that promote effective service delivery and data management in educational settings.

### 2.1 Review of Related Concepts

#### 2.1.1 Web-Based Information System (WBIS)

A Web-Based Information System (WBIS) is a digital platform that uses web technology to provide services, information access and processing capabilities across a network, typically through a standard web browser [3]. Such systems need no installation on the user’s device; data and application logic are centralized on remote servers. This ensures universal access, which is critical for services such as e-government portals or, in this case, student welfare services [3]. Internet-based academic information systems have also been found to improve the quality of education administration [4]. The adoption of a WBIS aims to improve transparency, widen participation and increase accountability through faster, easier and more reliable access to institutional information and services.

#### 2.1.2 Digital Attendance Monitoring

Digital Attendance Monitoring (DAM), also called Technology-Assisted Attendance Systems (TAASs), uses technological solutions such as mobile applications, biometrics or web-based logging to record and track the time and presence of individuals [5]. It replaces manual attendance processes, which are time-consuming and prone to human error or manipulation, with automated data capture [5]. Web-based time tracking also gives administrators immediate access to accurate records without paper handling [6], and web-based attendance management systems have been developed for schools for the same reason [7]. The main advantages of DAM are greater accuracy, less human intervention and more secure attendance records. For SWAP, DAM is the core function: it provides the verifiable time-in and time-out records on which stipend eligibility depends.

#### 2.1.3 Geofencing and Location-Based Attendance

A geofence is a virtual boundary around a real-world location. A mobile device compares its GPS position with that boundary to decide whether the user is inside or outside it. In attendance systems, geofencing confirms that a person is physically present at the expected place when they record their time. Che Fauzi et al. [8] developed TECH-CLASS, a geofencing-driven attendance system for higher education, and reported high usability and close agreement between geofence detection and verified presence, while noting that GPS accuracy indoors can be inconsistent. The system applies the same idea: each host office has a map location and a radius, a clock-in is accepted only inside that radius, and readings with poor accuracy (worse than 100 meters) are flagged for the office supervisor to review.

#### 2.1.4 QR Code-Based Attendance

A Quick Response (QR) code is a two-dimensional barcode that a smartphone camera can read quickly [9]. When a code is posted at a specific location and must be scanned to record attendance, the record is tied to that place. In the system, each host office has its own QR code; a recipient must scan their own office’s code to clock in and to clock out, and the code is combined with the geofence check and an optional selfie, so that scanning a photographed code from elsewhere is not enough.

#### 2.1.5 User Interface (UI) and User Experience (UX)

User Interface (UI) refers to the visual and interactive elements of a software application, while User Experience (UX) describes the user’s overall perception and response from using it [10]. UI design must prioritize clarity and effective navigation, while UX focuses on user satisfaction, learnability and efficiency [10]. Because the system is mandatory for SWAP recipients and is used mostly on phones, a smooth and intuitive UI and UX are essential to ensure high compliance, minimize errors in time logging and avoid resistance to the new platform.

#### 2.1.6 Database Management System (DBMS)

A Database Management System (DBMS) is software used to define, manipulate and manage a structured collection of related data, and is the backbone of any modern information system [11]. The DBMS ensures data integrity and security, and lets many users (students, supervisors and DSA staff) access and update information at the same time without conflicts [11]. The system uses **PostgreSQL**, an open-source relational DBMS, to store student profiles, applications, assignments, time logs, verification records, reports and stipend records, including the official verified service hours used for financial decisions.

#### 2.1.7 AI Chatbots

A chatbot is a program that answers users’ questions in natural language. Recent chatbots are built on large language models (LLMs), which generate answers from a given context instead of fixed keyword rules. Obenza et al. [12] analyzed university students’ attitude and behavior toward AI using an extended Unified Theory of Acceptance and Use of Technology (UTAUT) model, whose constructs include the expected performance of the tool and the effort needed to use it. The system’s chatbot uses Google Gemini to answer questions about SWAP requirements and the application process from the DSA’s FAQ knowledge base, and falls back to keyword matching when the AI service is unavailable, which reduces repeated inquiries to the office.

#### 2.1.8 Electronic Signatures

An electronic signature is any distinct mark in electronic form, such as a signature image, that a person attaches to an electronic document to show their approval. In the Philippines, the Electronic Commerce Act of 2000 (Republic Act No. 8792) gives legal recognition to electronic documents and electronic signatures [13]. The system lets each user save a signature specimen in their profile, and places the saved signatures of the office supervisor, the releasing DSA official and the recipient on the stipend stub, replacing the manual signing of paper forms.

#### 2.1.9 Student Assistantship and Service Learning

Student assistantship programs such as SWAP belong to a broader group of work-study opportunities that provide financial support to students while giving them real-world work experience that develops their skills. In a study of the Student Assistance Program of private higher education institutions in Cagayan de Oro City, Daroy [14] found that the program produced trained and skilled graduates who were later employed in the area. The success of such a program depends on monitoring and documenting the students’ contributions effectively. The system therefore serves as the instrument that records and verifies the service component of SWAP, ensuring that students fulfill their required hours in exchange for their benefits.

### 2.2 Review of Related Systems

#### 2.2.1 SmartPresence: Wi-Fi-Based Online Attendance Management for Smart Academic Assistance

This project created a simpler way to track student attendance in class using a Wi-Fi network and the students’ own devices, such as phones or laptops, which are logged automatically when present in a classroom. The approach removes the need for manual roll calls. It connects simple hardware, such as Wi-Fi routers, with a cloud-based platform that processes attendance in real time. The study by Rahaman et al. [15] showed that this method improves efficiency and reliability, since administrators and instructors can access attendance records through a web portal at any time, which makes the process transparent and more convenient.

The study notes that SmartPresence automates the recording of attendance and helps eliminate errors and “proxy” attendance by students who are not physically present. However, its function is limited to presence detection; it does not track the work or performance of the student during the session.

> **[Insert figure]** Keep the original screenshot from the December 2025 draft.
>
> *Figure 2.1 SmartPresence Interfaces: (a) Class Routine Search, (b) Scan Active Wi-Fi, (c) Student Details, (d) Class Routine Add, (e) Take Attendance, (f) Attendance Status Report*

#### 2.2.2 Online Internship Management and Monitoring System (OIMMS)

The Online Internship Management and Monitoring System (OIMMS) is a web-based platform developed to support the internship program of students in non-health-related degree programs by digitizing application checking, time tracking, task management and evaluation [16]. It was designed in response to the shift to online and flexible learning during the COVID-19 pandemic, when face-to-face internships were restricted and logbooks and paper-based documentation became difficult to manage. The system provides a built-in timesheet that records and displays the intern’s rendered and remaining required hours, lets OJT coordinators review uploaded requirements and student information, and lets company supervisors assign projects and tasks, monitor student accomplishments, and upload pre- and post-evaluation forms online.

> **[Insert figure]** Keep the original screenshot.
>
> *Figure 2.2 OIMMS Login Page*

> **[Insert figure]** Keep the original screenshot.
>
> *Figure 2.3 OIMMS List of Students Undergoing Internship*

> **[Insert figure]** Keep the original screenshot.
>
> *Figure 2.4 OIMMS Internship Report (Date, Remarks, Time and Internship Duration)*

#### 2.2.3 Student Management System

The Student Management System (SMS) is a web application designed to digitize the traditional record-keeping of student information. Its features include attendance, marks, grades, classes, terms, payments and faculty records, which are stored in an SQLite database and managed through the Django framework. Its design gives administrators complete control over data management through an interface built with HTML, CSS and JavaScript [17].

The Student Management System is closely related to this project, since it also improves institutional efficiency through digital monitoring and data management. While the SMS focuses on the academic side of student information, this project applies the concept to student welfare assistantship. It extends the SMS functions with online application submission, location-verified time tracking, supervisor verification and the generation of service reports, which are not present in the SMS project. The study provides a foundation for the database management and user accessibility of this project.

> **[Insert figure]** Keep the original screenshot.
>
> *Figure 2.5 Student Management System Home Page*

> **[Insert figure]** Keep the original screenshot.
>
> *Figure 2.6 Student Management System Dashboard*

#### 2.2.4 Web-Based Internship Management System for LPU–Cavite

The Web-Based Internship Management System for Lyceum of the Philippines University–Cavite is an online platform developed to modernize and streamline the university’s internship processes by replacing manual, paper-based procedures with a centralized web system [18]. It supports student registration, internship applications, submission of required documents based on existing templates, management of orientation schedules and attendance, posting and selection of internship vacancies by host training establishments, and monitoring of student internship status and reports. These improve documentation, communication and service quality for students, coordinators and industry partners.

This system is closely related to this project, because both improve institutional efficiency through web-based monitoring and records management for student programs. While the LPU system focuses on internship placement and coordination with external host establishments, this project focuses on student welfare assistantship within the university: online SWAP application handling, QR-code and geofence-verified time-in and time-out, supervisor verification of service hours, and the generation of service reports for recipients under the Division of Student Affairs.

> **[Insert figure]** Keep the original screenshot.
>
> *Figure 2.7 WEB-IMS Login Page*

> **[Insert figure]** Keep the original screenshot.
>
> *Figure 2.8 WEB-IMS Assigned Students Module*

> **[Insert figure]** Keep the original screenshot (the draft’s caption “Configuration of Internship Hours” described the next figure).
>
> *Figure 2.9 WEB-IMS Internship Application Record*

> **[Insert figure]** Keep the original screenshot (the draft’s caption “Classlist Management module” was incorrect).
>
> *Figure 2.10 WEB-IMS Internship Hours Configuration*

### 2.3 Summary of Related Systems

The reviewed systems address specific aspects of student monitoring, but none provides the complete functionality required by the Student Welfare Assistantship Program. SmartPresence uses Wi-Fi to automate attendance, but has no modules for application processing, supervisor verification or service reports. Internship platforms such as OIMMS and the Web-Based Internship Management System for LPU–Cavite offer registration, dashboards and monitoring, but they are tailored to external internship coordination and lack the internal workflows needed to verify service hours and to determine stipend eligibility.

General Student Management Systems maintain academic records and personal data well, but they are too broad in scope and lack the tools for location-verified duty tracking, the required Task Description at clock-out, and the term-end rules of SWAP. The system developed in this project bridges these gaps: it combines secure online application, interview scheduling, office assignment, QR-code and geofence-verified attendance, supervisor verification, end-of-term reporting, renewal and stipend release into one platform designed for the Division of Student Affairs.

### 2.4 Table Matrix of Related Systems

**Table 2.1 Summary of Related Systems**

| Feature | SmartPresence | OIMMS | WEB-IMS (LPU–Cavite) | Student Management System | SWAP Digital Monitoring and Application System |
|---|---|---|---|---|---|
| User Registration | ✔ | ✔ | ✔ | ✔ | ✔ |
| Login | ✔ | ✔ | ✔ | ✔ | ✔ |
| Dashboard | ✔ | ✔ | ✔ | ✔ | ✔ |
| Attendance Tracking | ✔ | ✔ | ✔ | ✔ | ✔ |
| Time Tracking | ✗ | ✔ | ✔ | ✗ | ✔ |
| Advanced Verification* | ✗ | ✗ | ✗ | ✗ | ✔ |
| Admin Management and Verification | ✔ | ✗ | ✔ | ✗ | ✔ |
| Reports and Notifications | ✗ | ✗ | ✔ | ✔ | ✔ |
| QR Code-Based Attendance | ✗ | ✗ | ✗ | ✗ | ✔ |
| GPS Geofencing | ✗ | ✗ | ✗ | ✗ | ✔ |
| Selfie Proof of Presence | ✗ | ✗ | ✗ | ✗ | ✔ |
| Email Verification Codes | ✗ | ✗ | ✗ | ✗ | ✔ |
| Chatbot | ✗ | ✗ | ✗ | ✗ | ✔ |
| Analytics and Data Visualization | ✔ | ✔ | ✔ | ✔ | ✔ |
| Stipend Status Tracking | ✗ | ✗ | ✗ | ✔ | ✔ |
| E-Signed Stipend Stub | ✗ | ✗ | ✗ | ✗ | ✔ |
| Renewal and Promissory Notes | ✗ | ✗ | ✗ | ✗ | ✔ |

*Note: *Advanced Verification means that each duty log is checked at the source (office QR code, GPS geofence and optional selfie) and then verified or rejected by the office supervisor before its hours count.*

### 2.5 Technical Background

The Division of Student Affairs (DSA) at Mindanao State University – Main Campus plays an important role in supporting students throughout their stay in the university [19]. It handles programs that address students’ needs, growth and well-being. One of these is the Student Welfare Assistantship Program (SWAP), a major support service of the DSA. Although helpful, SWAP still uses traditional steps such as in-person applications, paper-based documents and the manual checking of duty hours. Every year, the program accepts hundreds of students from the university’s population. Through this program, the DSA gives students opportunities to learn new skills, gain experience and receive assistance as they pursue their studies.

The Division of Student Affairs is responsible for managing SWAP. The staff manually review applications, check eligibility based on financial need and academic performance, interview applicants, and assign qualified students to offices. Once assigned, students and their coordinators still document the hours rendered on paper. Every step is done manually with printed forms, which slows down the process and can lead to delays.

This manual process presents several challenges, such as errors in student assignments, delays in processing applications, and difficulty in tracking the status of applications and hours. The reliance on printed forms and physical submission requires significant time and effort from both students and staff, which highlights the need for a more efficient and organized system.

To address these issues, the researchers developed a web-based system for the Student Welfare Assistantship Program of the Division of Student Affairs. Students submit and track their SWAP applications online, which reduces the need for physical visits. DSA staff review applications, schedule interviews and assign recipients through the system; office supervisors verify duty hours online; and stipend releases are recorded with signed stubs. Notifications are sent automatically by email and in-app, which ensures transparency and convenience for both students and staff.

#### 2.5.1 Organizational Structure

> **[Insert figure]** Keep the original organizational chart (the draft’s caption “Classlist Management module” was incorrect).
>
> *Figure 2.11 Organizational Structure of the Division of Student Affairs*

### 2.6 Workflow

#### 2.6.1 Existing Workflow

> **[Insert figure]** Keep the original diagram.
>
> *Figure 2.12 Existing Workflow*

Figure 2.12 illustrates the existing workflow, which starts when students submit their requirements to the DSA. The staff check and evaluate the documents, then schedule the student for an interview. Those who qualify are informed through text messages. Once accepted, each student is given a mentor or coordinator and assigned to a specific area. Every time the student finishes their duty, the coordinator signs their duty slip as proof of attendance. Every Friday, the coordinator computes and signs the weekly total of hours. At the end of the semester, the final hours are checked, and the students receive their allowance either in cash or through a bank transfer.

#### 2.6.2 Proposed Workflow

> **[Insert figure]** Insert docs/manuscript/figures/fig2-13-proposed-workflow.png (four swimlanes: Student Applicant, DSA Administrator, SWAP Recipient, Office Supervisor).
>
> *Figure 2.13 Proposed Workflow*

Figure 2.13 shows the proposed workflow in four swimlanes. A **student applicant** creates an account with their institutional email and student ID, confirms it with the six-digit code sent to their email, fills in the application form, uploads the certificate of registration, grade card, letter of intent and 2×2 photo, and submits the application. The **DSA administrator** reviews the application and schedules a face-to-face or online interview. A rejected applicant is notified and the process ends; an approved applicant becomes a **SWAP recipient** right away and is then assigned to a host office, an office supervisor and the required hours for the term. Results and updates reach students through email and in-app notifications.

The **recipient** clocks in by scanning their office’s QR code; the system checks the day and time, the GPS geofence and, when required, a selfie. After duty, the recipient scans the code again and writes the Task Description to clock out. If they leave the office geofence without clocking out, the system can clock them out automatically, and a session left open for more than twelve hours is closed. Each completed log becomes *Pending Verification*, and the **office supervisor** verifies or rejects it. Verified hours update the recipient’s dashboard, duty slips and semester service report automatically.

At the end of the term, the recipient submits the end-of-term report, which the supervisor accepts with a mark of eligible or not eligible for renewal; the system records each placement as Qualified or Deficient when the semester ends. A recipient who is short on hours may file one promissory note, which the supervisor approves or rejects. The DSA administrator releases the stipend once the hours are met (or covered by an approved promissory note), the recipient’s electronic signature is saved and the end-of-term report is submitted, which produces the signed stipend stub. Finally, a recipient who wants to continue applies for renewal, which the DSA approves only when the previous term is paid or covered and its report requirements are met. The system also provides reports, announcements and an “Ask the DSA” channel for concerns throughout the cycle.

## CHAPTER 3: METHODOLOGY

This chapter discusses the techniques and methods used by the researchers in conducting the study, the development method, and the diagrams of the different processes involved in the system.

The researchers use the Agile methodology as the project’s development life cycle. Agile is a dynamic and iterative approach to software development that prioritizes flexibility, collaboration and responsiveness to changing requirements.

> **[Insert figure]** Keep the original diagram.
>
> *Figure 3.1 Agile Methodology*

Figure 3.1 illustrates the Agile methodology with the Scrum framework adopted for this study. Agile is a project management approach that breaks development into distinct phases, emphasizing continuous collaboration and iterative improvement [20]. Software is developed and tested in increments rather than in a single delivery. The researchers use two-week sprints to complete specific sets of tasks and features for each release, so that a working build is available after every sprint, with new features added from one build to the next. Feedback from the DSA and from test users during development is incorporated in later sprints.

### 3.1 Requirements Gathering

#### 3.1.1 Empathy Map

> **[Insert figure]** Keep the original diagram.
>
> *Figure 3.2 Empathy Map for Student Applicants and SWAP Recipients*

Figure 3.2 illustrates the empathy map for student applicants and SWAP recipients. It synthesizes their experiences by outlining what they say, think, do and feel during the current manual process. It highlights key issues such as unclear status updates, repeated follow-ups on documents, reliance on paper duty slips, and difficulty tracking rendered and remaining hours, which increase uncertainty and stress, and support the need for a centralized system for application and service-hour monitoring.

> **[Insert figure]** Keep the original diagram.
>
> *Figure 3.3 Empathy Map for DSA Staff and Office Supervisors*

Figure 3.3 shows the empathy map for DSA staff and office supervisors (mentors). It outlines what they say, think, do and feel in the current manual workflow, and highlights time-consuming document checks, difficulty monitoring service hours across many offices, and burdensome manual computation of hours, together with concerns about lost records, computation errors and fairness. These support the need for a centralized system for monitoring, verification and record management.

#### 3.1.2 Functional and Non-Functional Requirements

**Table 3.1 Functional and Non-Functional Requirements**

| Requirement | Type | Priority |
|---|---|---|
| Students register with an institutional email (@s.msumain.edu.ph) and a nine-digit student ID; the account is created only after a six-digit code sent to that email is confirmed. | Functional | Mandatory |
| Users sign in with their email and password; when enabled by the DSA, an emailed sign-in code is also required unless the browser was trusted in the last 30 days. | Functional | Mandatory |
| Users recover a forgotten password with a code sent to their email. | Functional | Mandatory |
| The DSA invites office supervisors and administrators by email; only students self-register. | Functional | Mandatory |
| Students submit SWAP applications online and upload the certificate of registration, grade card, letter of intent (PDF, Word or image) and 2×2 photo. | Functional | Mandatory |
| DSA staff review applications, schedule face-to-face or online interviews, and approve or reject applications with remarks; an approved applicant becomes a SWAP recipient. | Functional | Mandatory |
| The DSA manages host offices: QR code, map location and geofence radius, capacity and automatic clock-out. | Functional | Mandatory |
| The DSA assigns each recipient to an office, an office supervisor and the required service hours for the term (200 by default). | Functional | Mandatory |
| Recipients clock in by scanning their office QR code; the system checks the allowed day and time, the GPS geofence and, when required, a selfie. | Functional | Mandatory |
| Recipients clock out by scanning the QR code and writing the session’s Task Description. | Functional | Mandatory |
| The system clocks a recipient out when they leave the geofence (if the office enables it) and closes sessions open for more than twelve hours. | Functional | Mandatory |
| The system automatically computes rendered, verified and remaining hours per term and shows the recipient’s pace. | Functional | Mandatory |
| Office supervisors monitor their assigned recipients, verify or reject their time logs, and add manual hours with a reason. | Functional | Mandatory |
| Recipients print weekly duty slips and a semester service report generated from verified logs. | Functional | Optional |
| Recipients submit one end-of-term report per term, typed or uploaded as a PDF or Word file; supervisors accept it and mark the recipient eligible or not eligible for renewal. | Functional | Mandatory |
| The DSA maintains the semester calendar; when a semester ends, the system records each placement as Qualified or Deficient. | Functional | Mandatory |
| A recipient short on hours after the semester ends may file one promissory note per semester, which the supervisor approves or rejects. | Functional | Mandatory |
| Recipients apply for renewal; the DSA approves a renewal only when the previous term is paid or covered and its end-of-term report requirements are met. | Functional | Mandatory |
| The DSA releases stipends to eligible recipients, individually or in bulk, after re-entering their password; each release creates a stub with a control number and a PDF signed with the saved electronic signatures; a stub can be voided with a reason. | Functional | Mandatory |
| Recipients save an electronic signature and view their stipend requirements, stubs and payment history per semester. | Functional | Mandatory |
| Users receive email and in-app notifications for major events (e.g., application result, verified hours, released stipend). | Functional | Mandatory |
| The DSA posts announcements, optionally with attachments. | Functional | Optional |
| Students send concerns to the DSA (“Ask the DSA”) and receive replies. | Functional | Optional |
| The system provides a chatbot that answers inquiries about SWAP requirements and the application process. | Functional | Optional |
| Each role has a dashboard summarizing application status, service hours and pending tasks. | Functional | Optional |
| Each role has Analytics & Reports with filters, charts and PDF/CSV export, including the distribution of recipients across offices. | Functional | Mandatory |
| The system keeps an audit log of key actions, with a history for each record. | Functional | Mandatory |
| The system is accessible through standard web browsers on desktop and mobile devices, with a responsive layout and light and dark themes. | Non-functional | Mandatory |
| The main dashboard loads within 3–5 seconds under normal network conditions. | Non-functional | Optional |
| User data is protected: passwords are hashed, access uses expiring tokens (Laravel Sanctum), every route is restricted by role, and sign-in, code and password endpoints are rate-limited. | Non-functional | Mandatory |
| Every business rule is enforced on the server; key actions are recorded in the audit log; releasing a stipend requires re-entering the password, and the stipend page locks after 15 minutes of inactivity. | Non-functional | Mandatory |
| Uploaded files are limited to 5 MB and to the allowed types (PDF, Word, JPG or PNG, depending on the document). | Non-functional | Mandatory |
| All date and time rules follow Philippine time (Asia/Manila). | Non-functional | Mandatory |
| The interface uses clear labels, a consistent layout and confirmation before risky actions, so that first-time users can complete basic tasks without formal training. | Non-functional | Optional |

Table 3.1 presents the key functional and non-functional requirements of the system with their priority. Functional requirements describe what the system must do: registering and signing in securely, submitting and reviewing applications, scheduling interviews, assigning recipients, recording location-verified duty hours, verifying them, closing each term, releasing stipends and keeping users informed. Most are mandatory because they support the core objective of digitizing the application and monitoring processes. Non-functional requirements describe how the system performs these functions: accessibility on desktop and mobile browsers, reasonable loading time, protection of user data through secure role-based access, server-side enforcement of rules, and an interface clear enough for first-time users. These are prioritized as mandatory or optional according to their impact on security, reliability and usability.

#### 3.1.3 Gantt Chart

**Table 3.2 Gantt Chart of the Development Phase**

| Activity | Sept–Oct 2025 W1 | Sept–Oct 2025 W2 | Sept–Oct 2025 W3 | Sept–Oct 2025 W4 | Nov–Dec 2025 W1 | Nov–Dec 2025 W2 | Nov–Dec 2025 W3 | Nov–Dec 2025 W4 | Jan–Feb 2026 W1 | Jan–Feb 2026 W2 | Jan–Feb 2026 W3 | Jan–Feb 2026 W4 | Mar–Apr 2026 W1 | Mar–Apr 2026 W2 | Mar–Apr 2026 W3 | Mar–Apr 2026 W4 | May–Jun 2026 W1 | May–Jun 2026 W2 | May–Jun 2026 W3 | May–Jun 2026 W4 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| System and Requirements Analysis | ■ | ■ | ■ | ■ | | | | | | | | | | | | | | | | |
| Data Gathering (DSA processes and forms) | | ■ | ■ | ■ | ■ | ■ | ■ | | | | | | | | | | | | | |
| Data Design and Database Development | | | | | | | | ■ | ■ | | | | | | | | | | | |
| Accounts and Authentication (registration, email codes, invitations) | | | | | | | | | ■ | ■ | | | | | | | | | | |
| Online Application Submission Module | | | | | | | | | | ■ | ■ | | | | | | | | | |
| Application Review, Interview and Status Update | | | | | | | | | | | | ■ | ■ | ■ | | | | | | |
| Office and Assignment Management (QR code, geofence) | | | | | | | | | | | | | ■ | ■ | | | | | | |
| Digital Clock-In/Clock-Out (QR, geofence, selfie) | | | | | | | | | | | | | | | ■ | ■ | | | | |
| Supervisor Verification and Task Descriptions | | | | | | | | | | | | | | | | ■ | ■ | | | |
| Time Computation and Summary (rendered/remaining) | | | | | | | | | | | | | | | | | ■ | ■ | | |
| End-of-Term Report, Promissory Notes and Renewal | | | | | | | | | | | | | | | | | ■ | ■ | | |
| Stipend Release and E-Signed Stub | | | | | | | | | | | | | | | | | | ■ | | |
| Dashboards (Applicant, Recipient, Supervisor, DSA) | | | | | | | | | | | | | | | | | | ■ | | |
| Reports and Analytics | | | | | | | | | | | | | | | | | | ■ | ■ | |
| Notifications, Announcements, Concerns and Chatbot | | | | | | | | | | | | | | | | | | | ■ | |
| Deployment (Vercel, Render) | | | | | | | | | | | | | | | | | | | ■ | ■ |
| Alpha and Beta Testing | | | | | | | | | | | | | | | | | | | ■ | ■ |

Table 3.2 shows the planned schedule of the project from September 2025 to June 2026, divided into two-week sprints. Requirements analysis and data gathering with the DSA come first, followed by database design. Development then proceeds module by module, from accounts and the application process to duty monitoring, the end of the term, the stipend, and communication and reports. The system is deployed in the last month, and Alpha and Beta testing close the schedule.

### 3.2 Design

#### 3.2.1 Hierarchical Input-Process-Output (HIPO)

> **[Insert figure]** Insert docs/manuscript/figures/fig3-4-hipo.png.
>
> *Figure 3.4 Hierarchical Input-Process-Output*

Figure 3.4 presents the Hierarchical Input-Process-Output (HIPO) model of the system. It decomposes the system into seven high-level modules and shows the functions of the Student Applicants, SWAP Recipients, Office Supervisors and DSA Administrators.

**Accounts and Security (2.0)** covers registration with an email code, sign-in with an optional email code and trusted browser, password recovery, staff invitations, and the profile with the electronic signature. **Application and Renewal (3.0)** covers the submission of applications with uploaded requirements, review and interview scheduling, approval or rejection, and renewal applications. **Duty Monitoring (4.0)**, the core operation, covers office assignment, QR clock-in with the geofence and selfie checks, QR clock-out with the Task Description, automatic clock-out, supervisor verification and duty slips. **End of Term and Stipend (5.0)** covers the end-of-term report and its acceptance, term results (Qualified or Deficient), promissory notes, and stipend release with the signed stub. **Administration (6.0)** covers users, offices with their QR codes and geofences, semester periods, settings and the audit log. **Communication (7.0)** covers email and in-app notifications, announcements, “Ask the DSA” concerns and the chatbot. **Analytics and Reports (8.0)** covers the dashboards, the reports with PDF and CSV export, and the stipend history. The supervisor’s verification of time logs is the critical input from which the system computes verified hours, term results, stipend eligibility and reports.

#### 3.2.2 Input-Process-Output

| Inputs | Processes | Outputs |
|---|---|---|
| Student’s personal information: first, middle and last name, nine-digit student ID, college, program and year level | Display the registration form, with colleges and programs from the official list | New applicant account created in the system |
| Institutional email (@s.msumain.edu.ph) and an optional contact number | Validate the inputs: required fields, email domain, student ID format, uniqueness of email and student ID, and the password rules (at least 8 characters with upper- and lower-case letters and a number) | Student profile linked to the account |
| Chosen password | Hold the registration for 30 minutes and email a six-digit code (valid for 10 minutes, up to 5 tries) | Applicant role and permissions assigned |
| Six-digit code from the email | On the correct code, create the user record with the Applicant role and its student profile | The student is signed in automatically and can apply |
| | Discard registrations that are never confirmed | |

*Figure 3.5 Input-Process-Output for Account Creation*

Figure 3.5 shows how a student’s personal details, institutional email, password and the code sent to that email are collected as inputs and validated by the system. The account is created only after the email code is confirmed, with the Applicant role, and the student is signed in automatically.

| Inputs | Processes | Outputs |
|---|---|---|
| Recipient’s signed-in session and active assignment (office, supervisor, required hours) | Check that the scanned QR code belongs to the recipient’s assigned office | Stored time-log records: time-in and time-out, GPS location and accuracy, flags, selfie, Task Description and duration |
| Office QR code scanned at time-in and time-out | Check the allowed day and time (Monday to Saturday, 6:00 AM to 5:30 PM, Philippine time) | Verification status of each log: Open, Pending Verification, Verified or Rejected |
| GPS coordinates and their accuracy | Check the GPS position against the office geofence; flag readings with accuracy worse than 100 meters | Updated rendered, verified and remaining hours and the pace on the recipient’s dashboard |
| Selfie photo (when required by the supervisor) | Create the time log at time-in; at time-out, save the Task Description and compute the duration | Weekly duty slips and the semester service report |
| Task Description entered at time-out | Close sessions automatically when the recipient leaves the geofence or after twelve hours | Supervisor’s queue of logs to verify |
| Supervisor’s decision (verify or reject) | Send each completed log to the office supervisor; recompute verified hours against the required hours | Term result (Qualified or Deficient) when the semester ends |

*Figure 3.6 Input-Process-Output for Time Computation*

Figure 3.6 illustrates how the recipient’s session, the office QR code, the GPS location, the selfie and the Task Description serve as inputs that the system checks, records and computes into hours. Each completed log is sent to the office supervisor for verification, and only verified hours count toward the required hours, the duty slips and the term result.

| Inputs | Processes | Outputs |
|---|---|---|
| Report type chosen by the user’s role | Allow only the reports of the user’s role (a supervisor sees only their own students; a recipient only their own records) | On-screen table and charts of the filtered data |
| Term (academic year and semester) | Filter the stored records on the server by term and the selected filters | PDF of exactly the filtered view, with the filters printed |
| Filters (e.g., college, office, verdict, status, search) | Sort, group and total the results | CSV file of the same data |
| Sort order and grouping | Compile the charts and the summary figures | Admin overview PDF |
| Request to download | Generate the PDF or CSV on demand and record the export in the audit log | Audit-log entry of who exported what |

*Figure 3.7 Input-Process-Output for Reports and Analytics*

Figure 3.7 presents how the user’s selected report, term, filters, sorting and grouping are processed on the server into on-screen tables and charts, and into PDF or CSV files of exactly what is on screen. Reports are generated on demand rather than archived. The available reports are: for DSA administrators, Applications, Recipients and Hours, Term Results, Stipend and Offices; for office supervisors, My Students and Term Results; and for recipients, My Time Logs and My Terms.

#### 3.2.3 Use Case Diagram

> **[Insert figure]** Insert docs/manuscript/figures/fig3-8-use-case.png.
>
> *Figure 3.8 Use Case Diagram*

Figure 3.8 illustrates the use case diagram of the Digital Monitoring and Application System, defining the interactions of the Student Applicant, SWAP Recipient, Office Supervisor and DSA Administrator. The **Student Applicant** registers and verifies their email, signs in, asks the chatbot, submits an application with its requirements (an «include» relationship), and tracks its status. The **SWAP Recipient** logs service hours, which «include» scanning the office QR code at time-in and time-out and writing the Task Description; views rendered hours, duty slips and stipend history; submits the end-of-term report; files a promissory note; applies for renewal; saves an electronic signature; and sends concerns to the DSA. The **Office Supervisor** monitors their assigned recipients, verifies or rejects time logs, accepts end-of-term reports with a renewal mark, reviews promissory notes and marks a term deficient. The **DSA Administrator** manages applications (review, interview scheduling, approval or rejection), offices and their QR codes, assignments, semester periods, stipend releases, announcements, user accounts and reports, and views the audit log. All users sign in, view their dashboard and receive notifications.

#### 3.2.4 Entity-Relationship Diagram

> **[Insert figure]** Insert docs/manuscript/figures/fig3-9-erd.png on a landscape page (core entities). The full schema, docs/database-erd.mmd, goes in the appendix.
>
> *Figure 3.9 Entity-Relationship Diagram (ERD)*

Figure 3.9 shows the core of the system’s database. All users are stored in one **users** table with a role (applicant, recipient, supervisor or admin); students have a one-to-one **student_profiles** record. A user submits **applications** (new or renewal), each with its **application_documents** and at most one **interviews** record. A recipient’s **assignments** link them to one **offices** record (which holds the location, geofence radius, QR secret and capacity) and to a supervisor, who is also a user, for one term defined in **semester_periods**. Each assignment has many **time_logs** (with GPS, accuracy, flags and selfie); each time log has a **narrative_reports** record for its Task Description and **verifications** records for the supervisor’s decisions. An assignment closes with one **term_reports** record and may have **promissory_notes**. Payments are stored in **stipend_history** (amount, control number, status, release and void details) with its **stipend_signatures**, and **audit_logs** record key actions on all of these. Supporting tables, such as notifications, announcements, concerns, the FAQ knowledge base, staff invitations, one-time codes and settings, are shown in the full schema in the appendix.

#### 3.2.5 Architectural Design

> **[Insert figure]** Insert docs/manuscript/figures/fig3-10-architecture.png.
>
> *Figure 3.10 Architectural Design*

Figure 3.10 presents the architecture of the system. Students and staff use a web browser on a phone or computer, which loads the front end, a Next.js application hosted on Vercel, over HTTPS. The front end calls the back end, a Laravel REST API hosted on Render, with JSON requests that carry the user’s access token. The API applies the business rules and reads and writes the PostgreSQL database on Render. It stores uploaded files (requirements, selfies, signatures, reports and stipend stubs) in Cloudflare R2 object storage, sends email through the Brevo email service, and asks Google Gemini for chatbot answers. A scheduler runs timed jobs: it closes sessions left open, records term results after each semester ends, and sends reminders.

### 3.3 Development

#### 3.3.1 Software Specification

The following tables list the minimum software requirements for the developers and the users of the system.

**Table 3.3 Developer’s Software Requirements**

| Software Requirement | Specification |
|---|---|
| Operating System | Windows 10 or later, or macOS |
| Back-End Language and Framework | PHP 8.2, Laravel 12 (with Composer) |
| Front-End Language and Framework | TypeScript, Next.js 15, React 19, Tailwind CSS 4 (with Node.js and npm) |
| Database | PostgreSQL 17 |
| Main Libraries | Laravel Sanctum (authentication), DomPDF (PDF), TanStack Query, Leaflet (maps), html5-qrcode (QR scanning), Recharts (charts) |
| IDE | Visual Studio Code |
| Version Control | Git and GitHub |
| Testing Tools | PHPUnit (back end), Vitest (front end) |
| Hosting and Services | Vercel (front end), Render (API, database, scheduler), Cloudflare R2 (files), Brevo (email), Google Gemini API (chatbot) |
| Web Browser | Google Chrome, Microsoft Edge, Mozilla Firefox |

**Table 3.4 User’s Software Requirements**

| Software Requirement | Specification |
|---|---|
| Operating System | Windows 10 or later, or macOS (computer); Android or iOS (smartphone) |
| Web Browser | Google Chrome or Microsoft Edge 111 or later, Safari 16.4 or later (iOS 16.4 or later), Mozilla Firefox 128 or later |
| Browser Permissions | Camera (QR scanning and selfie) and location (GPS) for SWAP recipients |
| Connection | Internet connection |
| Email | Institutional email account (@s.msumain.edu.ph) for students |

#### 3.3.2 Hardware Specification

The tables below describe the minimum hardware requirements for the developers and the users of the system.

**Table 3.5 Developer’s Hardware Requirements**

| Hardware Requirement | Specification |
|---|---|
| Computer | Laptop or desktop running Windows 10 or later, or macOS |
| Storage | 10 GB free space or higher |
| RAM (Random Access Memory) | 8 GB or higher |
| Processor | 2 GHz dual-core or higher |
| Test Device | Smartphone with camera and GPS (to test QR scanning and the geofence) |

**Table 3.6 User’s Hardware Requirements**

| Hardware Requirement | Specification |
|---|---|
| Device | Smartphone, laptop or desktop computer |
| Camera and GPS | Required for SWAP recipients (clock-in and clock-out) |
| Free Space | At least 1 GB (for the web browser) |
| RAM (Random Access Memory) | 2 GB or higher |
| Processor | 2 GHz or higher (computer); any current smartphone |

### 3.4 Testing

This section describes how the system is evaluated. Testing has two phases, as stated in Objective 4: **Alpha testing** by the developers, which checks that every function works as specified, and **Beta testing** with actual users, which measures usability with the System Usability Scale (SUS).

#### 3.4.1 Alpha Testing

Alpha testing is done by the researchers during and after development. It has two parts:

1. **Functional test cases.** The researchers execute a documented set of 608 test cases covering every module (registration, email verification, sign-in, applications, renewal, interviews, assignments, attendance, verification, end-of-term reports, promissory notes, stipend release, reports, notifications, announcements, concerns, settings, and security and access control). Each test case states its priority, preconditions, steps, test data and expected result, and covers both normal and invalid input. The actual result and status are recorded for each case.
2. **Automated tests.** Automated feature tests for the back end (PHPUnit, run against a PostgreSQL test database) and component tests for the front end (Vitest) are run after every change to catch regressions. At the time of writing there are 419 back-end feature tests and 81 front-end tests.

Defects found during Alpha testing are fixed and retested before Beta testing.

#### 3.4.2 Beta Testing

Beta testing is done with actual users on the deployed system, using their own devices. Respondents perform role-based tasks, including clocking in by scanning the QR code at an actual host office, and then answer the System Usability Scale. Their feedback is used to improve the system before final implementation.

#### 3.4.3 Respondents

The respondents consist of four user groups directly or indirectly involved in SWAP and the system. First, **DSA staff** are included because they review applications, schedule interviews, assign recipients, release stipends and generate reports. Second, **office supervisors** are included because they verify the service hours of their recipients, accept end-of-term reports and review promissory notes. Third, **SWAP recipients** take part because they use the system to log their duty hours, monitor their rendered and remaining hours, and view their reports and stipend. Fourth, **regular MSU students** (non-SWAP), selected at random, represent prospective applicants and first-time users; their participation helps assess the clarity and usability of the system for new users.

Respondents are chosen through a combination of purposive and random sampling. DSA staff, office supervisors and SWAP recipients are selected purposively because of their direct involvement in SWAP and their expected use of the system, while non-SWAP students are selected randomly from the MSU student population to provide unbiased feedback on navigation, understandability and overall user experience. All respondents must be enrolled or employed at MSU Marawi during the conduct of the study and must give informed consent before participating.

#### 3.4.4 Procedure

User testing is conducted after securing approval and coordinating the schedule with the DSA. Each session begins with an orientation and informed consent, followed by role-based task scenarios:

- **DSA staff:** review an application and schedule an interview; approve the applicant and assign them to an office; set up an office with its QR code and geofence; release a stipend; and generate a report.
- **Office supervisors:** verify and reject time logs; accept an end-of-term report with a renewal mark; review a promissory note; and view the My Students report.
- **SWAP recipients:** clock in by scanning the QR code at their office; clock out with a Task Description; view their hours and duty slip; save an electronic signature; and submit an end-of-term report.
- **Non-SWAP students:** register and confirm the email code; ask the chatbot about requirements; submit an application with the requirements; and check its status.

After completing the tasks, respondents answer the System Usability Scale and give brief feedback. The results are compiled and analyzed to guide improvements before final implementation. Beyond usability, technology acceptance models such as UTAUT and TAM note that perceived ease of use and usefulness influence whether staff and students adopt a new information system [21] [22]; the feedback is therefore also reviewed for these aspects.

#### 3.4.5 Instrument (Questionnaire)

The instrument for evaluating usability is the System Usability Scale (SUS) [23]. The SUS is a standardized questionnaire of ten statements rated on a five-point Likert scale (1 = Strongly Disagree to 5 = Strongly Agree). It measures users’ perceived ease of use, complexity, learnability, consistency and confidence when using a system. All respondent groups answer it right after their task scenarios, to capture fresh, experience-based ratings.

**Table 3.7 System Usability Scale Statements**

| No. | Statement |
|---|---|
| 1 | I think that I would like to use this system frequently. |
| 2 | I found the system unnecessarily complex. |
| 3 | I thought the system was easy to use. |
| 4 | I think that I would need the support of a technical person to be able to use this system. |
| 5 | I found the various functions in this system were well integrated. |
| 6 | I thought there was too much inconsistency in this system. |
| 7 | I would imagine that most people would learn to use this system very quickly. |
| 8 | I found the system very cumbersome to use. |
| 9 | I felt very confident using the system. |
| 10 | I needed to learn a lot of things before I could get going with this system. |

**Scoring.** For each respondent, each odd-numbered statement (1, 3, 5, 7, 9) contributes its rating minus 1, and each even-numbered statement (2, 4, 6, 8, 10) contributes 5 minus its rating. The ten contributions are added and multiplied by 2.5, which gives a score from 0 to 100 [23]. The mean score is computed for each respondent group and for all respondents.

**Interpretation.** A SUS score of 68 is commonly used as the average benchmark, so scores above 68 are considered above average [24]. Bangor et al. [25] associated SUS scores with adjective ratings, with mean scores of about 50.9 for “OK,” 71.4 for “Good,” 85.5 for “Excellent” and 90.9 for “Best Imaginable.” The results are used to identify usability issues and to guide improvements before final deployment and documentation.

## REFERENCES

[1] Richtmann, “Availability and accessibility of digital records,” *Journal of International Cooperation and Development*, pp. 42–53, 2024.

[2] O. A. Owolabi and A. O. Opaleye, “Manual vs digital student record management: A comparative study of selected universities in Nigeria,” *Journal of Educational Administration and Policy*, pp. 98–114, 2021.

[3] M. N. Nasution, T. H. M. Nasution and H. M., “The role of e-government and public information systems in increasing transparency and accountability in public services,” *International Journal of Economic Research and Financial Accounting (IJERFA)*, pp. 1–10, 2024.

[4] K. S. N. A. Marantika, “Use of internet-based academic information systems web in the development of quality of education administration,” *Journal Sustainable*, pp. 271–279, 2023.

[5] A. O. Orjiakor, S. O. Okafor and C. D. Onukwuli, “Which method of attendance-taking is superior? A systematic review of class attendance monitoring systems,” *Ikenga*, p. 84, 2025.

[6] Future Systems, “5 benefits of web-based time tracking,” Feb. 28, 2022. [Online]. Available: https://www.future-systems.net/blog/5-benefits-web-based-time-tracking

[7] A. O. B. and O. Omoniyi, “Development of a web-based student attendance management system using Visual Basic,” *FNAS Journal of Computing and Applications*, pp. 81–89, 2025.

[8] A. A. Che Fauzi et al., “TECH-CLASS: A geofencing-driven attendance management system for higher education,” *Journal of Mathematics and Computing Science*, vol. 11, no. 2, pp. 61–70, 2025, doi: 10.24191/jmcs.v11i2.9707.

[9] *Information Technology — Automatic Identification and Data Capture Techniques — QR Code Bar Code Symbology Specification*, ISO/IEC 18004:2015, International Organization for Standardization, 2015.

[10] E. D. Rinawiyanti, “Mixed method usability testing for user experience and user interface of AI-based supermarket applications,” *Journal of Applied Data Sciences*, pp. 483–495, 2024.

[11] P. Netinant, N. Saengsuwan, M. Rukhiran and S. Pukdesree, “Enhancing data management strategies with a hybrid layering framework in assessing data validation and high availability sustainability,” *Sustainability*, 2023.

[12] B. N. Obenza, R. B. R. Caangay, T. E. C. Makigod and S. M. Almocera, “Analyzing university students’ attitude and behavior toward AI using the extended Unified Theory of Acceptance and Use of Technology model,” *American Journal of Applied Statistics and Economics*, vol. 3, no. 1, pp. 99–108, 2024.

[13] *Electronic Commerce Act of 2000*, Republic Act No. 8792, Republic of the Philippines, Jun. 14, 2000.

[14] R. P. Daroy, “Student Assistance Program (SAP) among private higher education institutions (HEIs),” *JPAIR Multidisciplinary Research*, vol. 17, no. 1, pp. 31–45, 2014, doi: 10.7719/jpair.v17i1.279.

[15] M. Rahaman, M. M. Islam and D. Nandi, “SmartPresence: Wi-Fi-based online attendance management for smart academic assistance,” *Journal of Electrical Systems and Information Technology*, pp. 1–15, 2025.

[16] C. P. Calosa, J. C. D. Caraig and K. A. C. Sagala, “Online Internship Management and Monitoring System,” Batangas State University, Batangas City, 2021.

[17] A. P. Ramkumar, P. Pavan, A. Manish and S. Sankar, “Student Management System,” VIT Bhopal University, 2023.

[18] A. P. A. Pocaan, “Web-based internship management system for Lyceum of the Philippines University–Cavite,” Lyceum of the Philippines University–Cavite, 2021.

[19] Mindanao State University, “Division of Student Affairs.” [Online]. Available: https://www.msumain.edu.ph/division-of-student-affairs/

[20] I. Sommerville, *Software Engineering*, 10th ed. Pearson Education, 2016.

[21] A. Bayaga and A. du Plessis, “Ramifications of the Unified Theory of Acceptance and Use of Technology (UTAUT) among developing countries’ higher education staffs,” *Education and Information Technologies*, vol. 29, pp. 9689–9714, 2024.

[22] S. S. Wahyuningsih, C. H. Sumerli A., N. Rahayu and U. W. Nuryanto, “Application of Technology Acceptance Model and DeLone and McLean IS Success Model to measure information system design for academic activities in higher education institution,” *Jurnal Informasi dan Teknologi*, vol. 6, pp. 43–49, 2024.

[23] J. Brooke, “SUS: A ‘quick and dirty’ usability scale,” in *Usability Evaluation in Industry*, P. W. Jordan, B. Thomas, B. A. Weerdmeester and I. L. McClelland, Eds. London, U.K.: Taylor & Francis, 1996, pp. 189–194.

[24] J. Sauro, *A Practical Guide to the System Usability Scale: Background, Benchmarks & Best Practices*. Denver, CO, USA: Measuring Usability LLC, 2011.

[25] A. Bangor, P. Kortum and J. Miller, “Determining what individual SUS scores mean: Adding an adjective rating scale,” *Journal of Usability Studies*, vol. 4, no. 3, pp. 114–123, 2009.

## APPENDICES

Suggested appendices (to be completed for the final manuscript):

- Appendix A: Full database schema (render docs/database-erd.mmd).
- Appendix B: Functional test cases (docs/TEST_CASES.docx).
- Appendix C: System Usability Scale questionnaire and informed consent form.
- Appendix D: Screenshots of the system.

