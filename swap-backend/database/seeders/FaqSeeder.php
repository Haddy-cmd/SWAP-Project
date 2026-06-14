<?php

namespace Database\Seeders;

use App\Models\FaqKnowledgeBase;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    public function run(): void
    {
        $faqs = [
            ['category' => 'eligibility', 'question' => 'Who is eligible to apply for the SWAP program?', 'answer' => 'Students who are financially challenged, currently enrolled at MSU Marawi, with a GPA of at least 2.0, and in good academic standing are eligible to apply for the SWAP program.', 'keywords' => ['eligible', 'qualify', 'requirement', 'gpa', 'financial', 'enrolled'], 'sort_order' => 1],
            ['category' => 'eligibility', 'question' => 'Can graduating students apply for SWAP?', 'answer' => 'Yes, graduating students may apply for SWAP as long as they meet the eligibility requirements. However, priority is given to students with more remaining semesters.', 'keywords' => ['graduate', 'graduating', 'senior', 'last', 'year'], 'sort_order' => 2],
            ['category' => 'application', 'question' => 'What documents are required for the SWAP application?', 'answer' => 'Required documents include: Certificate of Enrollment, Certified True Copy of Grades, Certificate of Financial Need (from Barangay or Social Worker), 2x2 ID photo, and Recommendation Letter from a faculty member.', 'keywords' => ['document', 'requirement', 'requirement', 'certificate', 'grade', 'photo', 'recommendation'], 'sort_order' => 3],
            ['category' => 'application', 'question' => 'How do I submit my SWAP application?', 'answer' => 'You can submit your application through the SWAP Portal at swap.msu-marawi.edu.ph. Register an account, complete your profile, fill out the application form, and upload the required documents. The DSA Office will review your application and notify you of the outcome.', 'keywords' => ['submit', 'apply', 'application', 'portal', 'online', 'register'], 'sort_order' => 4],
            ['category' => 'application', 'question' => 'How long does the application review take?', 'answer' => 'The DSA Office typically reviews applications within 5-10 working days after the submission deadline. You will receive an email and in-app notification once a decision has been made.', 'keywords' => ['review', 'processing', 'waiting', 'decision', 'days', 'long'], 'sort_order' => 5],
            ['category' => 'service_hours', 'question' => 'How many service hours are required per semester?', 'answer' => 'Recipients are required to render 120 service hours per semester. Your supervisor will verify your rendered hours.', 'keywords' => ['hours', 'service', 'requirement', 'semester', 'many', 'required'], 'sort_order' => 6],
            ['category' => 'service_hours', 'question' => 'How do I record my time-in and time-out?', 'answer' => 'Use the QR code assigned to your office. Open the SWAP Portal, go to Attendance > Scan QR, and scan the code at your assigned office. Before timing out, you must submit a narrative report for that session.', 'keywords' => ['time', 'clock', 'qr', 'scan', 'attendance', 'record'], 'sort_order' => 7],
            ['category' => 'service_hours', 'question' => 'What happens if my supervisor rejects my attendance log?', 'answer' => 'If your supervisor rejects your log, you will receive a notification with their feedback. Rejected hours do not count toward your required 120 hours. Please contact your supervisor to discuss the rejection.', 'keywords' => ['reject', 'rejected', 'supervisor', 'feedback', 'invalid'], 'sort_order' => 8],
            ['category' => 'stipend', 'question' => 'How much is the SWAP stipend?', 'answer' => 'The SWAP stipend varies depending on the semester budget allocation. Typically, recipients receive between ₱2,000 to ₱5,000 per semester. The exact amount will be communicated upon approval of the semester budget.', 'keywords' => ['stipend', 'allowance', 'amount', 'money', 'pay', 'salary'], 'sort_order' => 9],
            ['category' => 'stipend', 'question' => 'When is the stipend released?', 'answer' => 'Stipends are released at the end of the semester, once all required service hours have been verified. You will receive a notification when your stipend is ready for release. Please coordinate with the DSA Office for the release schedule.', 'keywords' => ['release', 'when', 'payment', 'receive', 'stipend', 'schedule'], 'sort_order' => 10],
            ['category' => 'interview', 'question' => 'What should I expect during the SWAP interview?', 'answer' => 'The interview is a 15-30 minute session with a DSA staff member. You will be asked about your financial situation, academic performance, and motivation for joining SWAP. Please bring original copies of your submitted documents.', 'keywords' => ['interview', 'prepare', 'expect', 'question', 'bring', 'documents'], 'sort_order' => 11],
            ['category' => 'interview', 'question' => 'Can I reschedule my interview?', 'answer' => 'If you cannot attend your scheduled interview, please contact the DSA Office immediately at dsaoffice@msu-marawi.edu.ph or visit the office. Late rescheduling may result in application forfeiture.', 'keywords' => ['reschedule', 'change', 'interview', 'date', 'cancel'], 'sort_order' => 12],
        ];

        foreach ($faqs as $faq) {
            FaqKnowledgeBase::create(array_merge($faq, ['is_active' => true]));
        }
    }
}
