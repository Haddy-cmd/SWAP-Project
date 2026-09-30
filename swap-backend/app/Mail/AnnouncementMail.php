<?php

namespace App\Mail;

use App\Models\Announcement;
use App\Support\Frontend;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** The email copy of a DSA announcement, sent to recipients in Bcc batches. */
class AnnouncementMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly Announcement $announcement) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'SWAP Announcement: ' . $this->announcement->title);
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.announcement',
            with: [
                'title' => $this->announcement->title,
                // Blank lines separate paragraphs; single line breaks are kept inside them.
                'paragraphs' => preg_split('/\R\s*\R/', trim($this->announcement->message)),
                'portalUrl' => Frontend::url('/notifications'),
            ],
        );
    }
}
