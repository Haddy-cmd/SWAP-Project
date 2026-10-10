<x-mail::message>
# {{ $title }}

{{-- Each paragraph is one raw-HTML line: the admin's text is escaped and shown as
     written (line breaks kept), never read as Markdown. --}}
@foreach ($paragraphs as $paragraph)
<div style="margin: 0 0 14px; line-height: 1.6;">{!! implode('<br>', array_map('e', preg_split('/\R/', trim($paragraph)))) !!}</div>
@endforeach

@if (!empty($attachments))
<div style="margin: 4px 0 14px; padding: 12px 14px; border-radius: 8px; background: #F6F7F3;">
<strong>Attachments ({{ count($attachments) }})</strong><br>
@foreach ($attachments as $file)
• {{ $file['name'] }} ({{ $file['size'] }})<br>
@endforeach
<span style="color: #6B7A71;">Open the SWAP Portal to view or download them.</span>
</div>
@endif

<x-mail::button :url="$portalUrl">
Open the SWAP Portal
</x-mail::button>

Division of Student Affairs<br>
Mindanao State University — Marawi

<x-mail::subcopy>
You are receiving this because you are an active SWAP recipient. It is also in your Notifications on the portal.
</x-mail::subcopy>
</x-mail::message>
