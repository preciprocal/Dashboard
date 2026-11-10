// lib/outreach/templates.ts
// The outreach template library behind /templates/outreach.
//
// Every template is written to be sent nearly as is: a clear ask, a reason
// the reader should care, and nothing a recruiter has seen a thousand times
// ("I hope this email finds you well", "I am writing to express my
// interest"). Fill-in fields are in [square brackets] so the page can
// highlight them and the user can see at a glance what still needs editing.
//
// Lengths follow what each channel allows: a LinkedIn connection note is
// capped at 300 characters, so those templates stay under it.

export type OutreachChannel = "email" | "linkedin";

export type OutreachCategory =
  | "recruiters"
  | "hiring-managers"
  | "referrals"
  | "networking"
  | "follow-ups"
  | "interviews"
  | "offers"
  | "special";

export interface OutreachTemplate {
  id: string;
  category: OutreachCategory;
  channel: OutreachChannel;
  title: string;
  /** When to use it, in one line. */
  situation: string;
  /** Email subject. LinkedIn messages have none. */
  subject?: string;
  body: string;
  tips: string[];
}

export const OUTREACH_CATEGORIES: { id: OutreachCategory; label: string; description: string }[] = [
  { id: "recruiters",      label: "Recruiters",          description: "Getting on a recruiter's radar and replying to one" },
  { id: "hiring-managers", label: "Hiring managers",     description: "Going straight to the person who owns the role" },
  { id: "referrals",       label: "Referrals",           description: "Asking for a referral from friends, alumni and strangers" },
  { id: "networking",      label: "Networking",          description: "Informational interviews, events and staying in touch" },
  { id: "follow-ups",      label: "Follow-ups",          description: "After applying, after silence, after a no" },
  { id: "interviews",      label: "Interviews",          description: "Thank-you notes, scheduling and asking for feedback" },
  { id: "offers",          label: "Offers",              description: "Negotiating, accepting, declining and deadlines" },
  { id: "special",         label: "Special situations",  description: "Career changes, visas, gaps, internships and more" },
];

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  // ─── Recruiters ────────────────────────────────────────────────────────────
  {
    id: "recruiter-cold-email",
    category: "recruiters",
    channel: "email",
    title: "Cold email to a recruiter about an open role",
    situation: "You applied (or are about to) and want a human to look at your application.",
    subject: "[Role title] application: [your one-line hook]",
    body: `Hi [Recruiter name],

I just applied for the [Role title] role at [Company] (job ID [ID]) and wanted to put a name to the application.

Quick summary of why I think I fit:
- [Most relevant achievement with a number, e.g. "Cut API latency 40% for a service handling 2M requests a day"]
- [Second achievement tied to a requirement in the posting]
- [Skill or domain the posting asks for, and where you used it]

I am especially interested in [specific product, team or problem at Company] because [one honest reason].

My resume is attached. If it looks like a match, I would be glad to set up a quick call this week or next.

Thanks for your time,
[Your name]
[LinkedIn URL] | [Phone]`,
    tips: [
      "Send it within 48 hours of applying, while your application is at the top of the pile.",
      "Mirror two or three keywords from the posting in your bullets so the fit is obvious in a skim.",
      "Find the recruiter on LinkedIn by searching \"[Company] recruiter [team or location]\".",
    ],
  },
  {
    id: "recruiter-linkedin-connect",
    category: "recruiters",
    channel: "linkedin",
    title: "LinkedIn connection note to a recruiter",
    situation: "Connecting with a recruiter who hires for your field (under 300 characters).",
    body: `Hi [Name], I'm a [your role] with [X] years in [domain] and just applied for [Role title] at [Company]. I'd love to connect and be on your radar for [team or type of role]. Thanks!`,
    tips: [
      "Keep it under 300 characters, LinkedIn's limit for connection notes.",
      "Name the exact role so the recruiter can find your application in seconds.",
    ],
  },
  {
    id: "recruiter-reply-interested",
    category: "recruiters",
    channel: "email",
    title: "Replying to a recruiter who reached out (interested)",
    situation: "A recruiter contacted you about a role and you want to move forward.",
    subject: "Re: [Their subject line]",
    body: `Hi [Recruiter name],

Thanks for reaching out. The [Role title] role sounds like a strong fit, and I would be glad to learn more.

A bit of context on me: I am currently [current role and company], where I [one-line achievement]. I am looking for [what you want next, e.g. "a backend role with more ownership of system design"].

I am free for a call:
- [Day, date, time range, time zone]
- [Day, date, time range, time zone]

Could you also share the salary range and whether the role is remote, hybrid or on-site? That helps me make sure we are aligned before we both spend time on it.

Best,
[Your name]`,
    tips: [
      "Offer two concrete time windows. It roughly halves the back and forth.",
      "Asking about salary range and location up front is normal and saves everyone time.",
    ],
  },
  {
    id: "recruiter-reply-not-now",
    category: "recruiters",
    channel: "email",
    title: "Replying to a recruiter (not right now, keep in touch)",
    situation: "The role isn't right, but you want to keep the relationship.",
    subject: "Re: [Their subject line]",
    body: `Hi [Recruiter name],

Thank you for thinking of me for the [Role title] role. It is not the right move for me at the moment, as [brief honest reason, e.g. "I am focused on staying in fintech" or "I recently started a new project I want to see through"].

I would genuinely like to stay in touch, though. The kind of role that would get my attention is [specific description: level, area, location or remote].

If something like that opens up, please keep me in mind. And if I can point anyone from my network your way for this role, I am happy to.

Best,
[Your name]`,
    tips: [
      "Describing what would interest you turns a no into a future yes.",
      "Offering to refer someone builds goodwill recruiters remember.",
    ],
  },
  {
    id: "recruiter-check-in",
    category: "recruiters",
    channel: "email",
    title: "Checking in with a recruiter you already know",
    situation: "You spoke with a recruiter before and are now actively looking.",
    subject: "Back on the market: [your role] with [key skill]",
    body: `Hi [Recruiter name],

We spoke back in [month or context] about [role or company]. I wanted to let you know I am now actively looking.

Since we last talked I have [new achievement, promotion or skill]. I am focused on [type of role, level and location or remote], ideally starting [timeframe].

If you are working on anything in that space, I would love to hear about it. My updated resume is attached.

Thanks,
[Your name]`,
    tips: ["Lead with what changed since you last spoke so the recruiter has a reason to look again."],
  },

  // ─── Hiring managers ───────────────────────────────────────────────────────
  {
    id: "hm-cold-email",
    category: "hiring-managers",
    channel: "email",
    title: "Cold email to the hiring manager",
    situation: "You found the person the role reports to and want to skip the queue.",
    subject: "[Specific result you can bring] for [team name]",
    body: `Hi [Hiring manager name],

I saw that [Company] is hiring a [Role title] on your team. I applied, and wanted to reach out to you directly because [specific reason: something the team shipped, wrote or announced].

In my current role at [Company] I [achievement most relevant to their team, with a number]. Before that, I [second relevant result].

From the posting, it sounds like the team needs someone who can [requirement in your own words]. That is exactly the work I have been doing for [time period].

Would you be open to a 15-minute call to see if there is a fit? If it is easier, I am also happy to answer a couple of questions over email.

Thanks,
[Your name]
[LinkedIn URL]`,
    tips: [
      "Reference something specific the team did. It proves this is not a mass email.",
      "Ask for 15 minutes, not 30. Small asks get more yeses.",
      "Hiring managers often post on LinkedIn that they are hiring. Search their posts first.",
    ],
  },
  {
    id: "hm-linkedin-message",
    category: "hiring-managers",
    channel: "linkedin",
    title: "LinkedIn message to a hiring manager",
    situation: "Already connected, or messaging via InMail.",
    body: `Hi [Name],

I noticed you are hiring a [Role title] for [team]. I applied today and wanted to say hello directly.

I have spent the last [X] years [what you do], most recently [one result with a number]. Your team's work on [specific project] is a big reason I applied.

If you have 15 minutes in the next week or two, I would love to hear what success looks like in the role.

Thanks,
[Your name]`,
    tips: ["Asking what success looks like gives them an easy, flattering question to answer."],
  },
  {
    id: "hm-no-opening",
    category: "hiring-managers",
    channel: "email",
    title: "Reaching out when there is no open role",
    situation: "You want to work at a company that isn't hiring for your role yet.",
    subject: "[Your role] interested in [team or product] at [Company]",
    body: `Hi [Name],

I have followed [Company]'s work on [product or problem] for a while, especially [specific detail]. I do not see an open [your role] position right now, but I wanted to introduce myself in case one opens up or the team is planning ahead.

I am a [your role] with experience in [skill 1], [skill 2] and [skill 3]. Recently I [relevant achievement].

If it would be useful, I am happy to share some quick thoughts on [area you could help with], with no strings attached. Either way, I would appreciate being on your radar.

Best,
[Your name]`,
    tips: [
      "Roles are often filled before they are posted. Being known early matters.",
      "A concrete offer of value makes the email worth replying to.",
    ],
  },

  // ─── Referrals ─────────────────────────────────────────────────────────────
  {
    id: "referral-friend",
    category: "referrals",
    channel: "email",
    title: "Asking a friend or former colleague for a referral",
    situation: "Someone who knows your work is at the company.",
    subject: "Quick favour: referral for [Role title] at [Company]?",
    body: `Hi [Name],

Hope [personal detail, e.g. "the new team is treating you well"]. I am applying for the [Role title] role at [Company] ([link to posting]) and wondered if you would be comfortable referring me.

To make it easy, here is what you could pass along:
- Why I fit: [one or two sentences]
- Recent highlight: [achievement with a number]
- Resume: attached

No pressure at all if it is awkward or you do not know the team. And if you think another role there suits me better, I would love your take.

Thanks so much,
[Your name]`,
    tips: [
      "Give them a ready-made blurb. Most people want to help but don't know what to write.",
      "Always give an easy out. It keeps the relationship safe either way.",
    ],
  },
  {
    id: "referral-alumni",
    category: "referrals",
    channel: "linkedin",
    title: "Asking a fellow alum for a referral",
    situation: "You share a school or program with someone at the company.",
    body: `Hi [Name],

I am a fellow [School] grad ([your program and year]) and saw you are a [their role] at [Company]. I am applying for the [Role title] role and would love to hear what the team is like.

Quick background: [one-line summary with a result].

Would you be open to a 15-minute chat? If after that you feel comfortable referring me, that would mean a lot, but I would value your perspective either way.

Thanks,
[Your name]`,
    tips: [
      "Ask for a chat first and the referral second. Asking a stranger to vouch for you cold rarely works.",
      "Shared schools get noticeably higher reply rates. Search LinkedIn by school and company.",
    ],
  },
  {
    id: "referral-stranger",
    category: "referrals",
    channel: "linkedin",
    title: "Asking someone you don't know (employee at the company)",
    situation: "No shared connection, but they work on the team you're targeting.",
    body: `Hi [Name],

I came across your [post, talk or project] on [topic] and really liked [specific detail]. I am applying for the [Role title] role on [team] at [Company].

I have [X] years doing [relevant work], most recently [result with a number]. I would love to ask you two or three quick questions about the team, if you have 10 minutes sometime.

Thanks either way,
[Your name]`,
    tips: [
      "Lead with something they made or said. It shows effort and starts a real conversation.",
      "If the chat goes well, they will often offer to refer you without being asked.",
    ],
  },
  {
    id: "referral-after-chat",
    category: "referrals",
    channel: "email",
    title: "Asking for the referral after an informational chat",
    situation: "You had a good conversation and now want to ask directly.",
    subject: "Thanks for the chat, and a quick ask",
    body: `Hi [Name],

Thanks again for taking the time to talk on [day]. Your point about [something specific they said] was really helpful, and it made me even more excited about [Company].

I have applied for the [Role title] role ([link]). Would you be comfortable submitting a referral? I have attached my resume and a short summary below in case it helps:

[Two or three sentences on why you fit, with one number.]

Completely understand if not. Either way, I really appreciate the time.

Best,
[Your name]`,
    tips: ["Send this within 24 hours of the chat, while you are fresh in their mind."],
  },
  {
    id: "referral-thank-you",
    category: "referrals",
    channel: "email",
    title: "Thanking someone for referring you",
    situation: "Right after they submit the referral.",
    subject: "Thank you for the referral",
    body: `Hi [Name],

Thank you so much for referring me for the [Role title] role. I know it takes time and puts your name on the line, and I really appreciate it.

I will keep you posted on how it goes. And if there is ever anything I can help you with, whether a referral, an introduction or a second pair of eyes on something, please just ask.

Thanks again,
[Your name]`,
    tips: ["Update them when you hear back, good news or not. People remember who closed the loop."],
  },

  // ─── Networking ────────────────────────────────────────────────────────────
  {
    id: "networking-informational",
    category: "networking",
    channel: "email",
    title: "Requesting an informational interview",
    situation: "You want advice from someone in a role or company you're targeting.",
    subject: "15 minutes on your path into [field or role]?",
    body: `Hi [Name],

I am [your name], a [current role or student status] exploring a move into [field or role]. Your path from [their previous role] to [current role] stood out to me, especially [specific detail].

Would you be open to a 15-minute call in the next couple of weeks? I would love to ask:
- What you wish you had known before moving into [field]
- Which skills matter most day to day
- How you would approach breaking in today

I am happy to work around your schedule, and a call or video works equally well.

Thank you,
[Your name]`,
    tips: [
      "Listing your questions shows you'll respect their time.",
      "Do not ask for a job in this call. Ask for advice; opportunities follow.",
    ],
  },
  {
    id: "networking-event-follow-up",
    category: "networking",
    channel: "linkedin",
    title: "Following up after a career fair or event",
    situation: "You met someone briefly and want to turn it into a connection.",
    body: `Hi [Name], great meeting you at [event] on [day]. I enjoyed our chat about [topic]. I'd love to stay in touch and hear more about [their team or company]. Thanks!`,
    tips: [
      "Send it the same day or the next morning, while they still remember your face.",
      "Mention the exact topic you discussed so they can place you.",
    ],
  },
  {
    id: "networking-reconnect",
    category: "networking",
    channel: "linkedin",
    title: "Reconnecting with an old contact",
    situation: "You haven't spoken in a while and want to warm the relationship back up.",
    body: `Hi [Name],

It has been a while since [shared context, e.g. "we worked on the X project together"]. I saw [their recent news: new role, post or launch] and wanted to say congratulations.

On my side, I have been [brief update]. I am starting to look at [type of role] and would love to catch up sometime and hear how things are going at [their company].

Hope you are well,
[Your name]`,
    tips: ["Lead with their news, not your ask. The ask can come in the second message."],
  },
  {
    id: "networking-thank-you-advice",
    category: "networking",
    channel: "email",
    title: "Thank-you after an informational interview",
    situation: "Same day as the call.",
    subject: "Thank you for your time today",
    body: `Hi [Name],

Thank you for talking with me today. Your advice about [specific advice] was especially useful, and I am already [action you are taking because of it].

I will let you know how things progress. If there is ever anything I can do for you, please let me know.

Best,
[Your name]`,
    tips: ["Naming one action you took because of their advice is what makes people want to help again."],
  },
  {
    id: "networking-update",
    category: "networking",
    channel: "email",
    title: "Closing the loop with someone who helped",
    situation: "Weeks later, when you have news to share.",
    subject: "Update: your advice paid off",
    body: `Hi [Name],

Quick update: I wanted to let you know that [news, e.g. "I just accepted an offer at X" or "I landed interviews at two of the companies you mentioned"].

Your advice about [specific advice] made a real difference, especially [how it helped]. Thank you again for taking the time.

If I can ever return the favour, I would be glad to.

Best,
[Your name]`,
    tips: ["Few people do this, which is exactly why it is remembered."],
  },

  // ─── Follow-ups ────────────────────────────────────────────────────────────
  {
    id: "follow-up-after-applying",
    category: "follow-ups",
    channel: "email",
    title: "Follow-up one week after applying",
    situation: "You applied and haven't heard anything.",
    subject: "Following up: [Role title] application",
    body: `Hi [Name],

I applied for the [Role title] role on [date] and wanted to follow up, as I am very interested in the position.

Since applying, I [new relevant detail: finished a project, earned a certification, or researched the team's recent launch and had an idea about it].

Is there any more information I can provide? I would be glad to talk whenever works for you.

Thanks,
[Your name]`,
    tips: [
      "Add something new. A follow-up that only says \"just checking in\" gives them nothing to act on.",
      "Wait five to seven business days after applying.",
    ],
  },
  {
    id: "follow-up-no-reply",
    category: "follow-ups",
    channel: "email",
    title: "Second follow-up after no reply",
    situation: "Your first message got no answer after a week or more.",
    subject: "Re: [Original subject]",
    body: `Hi [Name],

Bumping this in case it got buried. I know inboxes get busy.

I am still very interested in the [Role title] role. If the timing is not right or someone else owns hiring for it, I would be grateful if you could point me in the right direction.

Thanks,
[Your name]`,
    tips: [
      "Reply in the same thread so they see the original message.",
      "Asking who else to contact gives them a one-line way to help.",
      "After two follow-ups with no reply, move on.",
    ],
  },
  {
    id: "follow-up-after-rejection",
    category: "follow-ups",
    channel: "email",
    title: "Responding to a rejection",
    situation: "You got a no and want to leave the door open.",
    subject: "Re: [Role title]",
    body: `Hi [Name],

Thank you for letting me know, and for the time you and the team spent with me. I am disappointed, but I really enjoyed learning about [Company] and [specific thing you liked about the team].

If you are able to share any feedback on where I could have been stronger, I would genuinely appreciate it.

I would love to be considered for future roles that fit, so please keep me in mind.

Best,
[Your name]`,
    tips: [
      "A gracious reply is rare and memorable. Recruiters do come back to these candidates.",
      "Asking for feedback is fine. Pushing back on the decision is not.",
    ],
  },
  {
    id: "follow-up-status-check",
    category: "follow-ups",
    channel: "email",
    title: "Checking on status after the stated deadline",
    situation: "They said you'd hear by a date, and the date has passed.",
    subject: "Checking in: [Role title] next steps",
    body: `Hi [Name],

I hope the week is going well. When we last spoke, you mentioned the team expected to decide by [date]. I wanted to check whether there is any update on the [Role title] role.

I am still very interested. If it helps the team's decision, I am happy to provide references or answer any remaining questions.

Thank you,
[Your name]`,
    tips: ["Wait two business days past the date they gave before sending."],
  },

  // ─── Interviews ────────────────────────────────────────────────────────────
  {
    id: "interview-thank-you",
    category: "interviews",
    channel: "email",
    title: "Thank-you email after an interview",
    situation: "Within 24 hours of any interview round.",
    subject: "Thank you: [Role title] interview",
    body: `Hi [Interviewer name],

Thank you for taking the time to speak with me today about the [Role title] role. I enjoyed our conversation, especially [specific topic you discussed].

It made me even more excited about the chance to [what you would work on]. Thinking about your question on [question], I would add [a sharper point or extra example you thought of afterwards].

Please let me know if I can provide anything else. I look forward to hearing about next steps.

Best,
[Your name]`,
    tips: [
      "Send a separate note to each interviewer and reference something different in each.",
      "Using it to strengthen one answer turns a courtesy note into a second pitch.",
    ],
  },
  {
    id: "interview-reschedule",
    category: "interviews",
    channel: "email",
    title: "Asking to reschedule an interview",
    situation: "Something came up and you need a new time.",
    subject: "Request to reschedule: [Role title] interview on [date]",
    body: `Hi [Name],

I am very sorry, but [brief reason, e.g. "a family matter has come up"] and I will not be able to make our interview on [date and time].

I am still very interested in the role. Would any of these times work instead?
- [Option 1]
- [Option 2]
- [Option 3]

I apologise for the inconvenience and appreciate your flexibility.

Best,
[Your name]`,
    tips: [
      "Give as much notice as you can, and always offer specific new times.",
      "Keep the reason short. No one needs the details.",
    ],
  },
  {
    id: "interview-confirm",
    category: "interviews",
    channel: "email",
    title: "Confirming an interview",
    situation: "Replying to an invite to lock in the details.",
    subject: "Re: [Role title] interview",
    body: `Hi [Name],

Thank you for the invitation. I am confirming our interview on [day, date] at [time and time zone] via [platform or address].

Could you let me know who I will be meeting with and whether there is anything I should prepare in advance?

Looking forward to it,
[Your name]`,
    tips: ["Asking who you'll meet lets you research each interviewer beforehand."],
  },
  {
    id: "interview-feedback-request",
    category: "interviews",
    channel: "email",
    title: "Asking for feedback after a final round",
    situation: "You didn't get the offer and want to know why.",
    subject: "Request for feedback: [Role title]",
    body: `Hi [Name],

Thank you again for the opportunity to interview for the [Role title] role. While I am disappointed, I appreciate the team's time.

I am working on improving my interviewing, and any feedback you could share would be really valuable, even a sentence or two on what would have made me a stronger candidate.

Thank you, and I hope our paths cross again.

Best,
[Your name]`,
    tips: ["Many companies won't share details for legal reasons. Ask politely once and accept the answer."],
  },
  {
    id: "interview-withdraw",
    category: "interviews",
    channel: "email",
    title: "Withdrawing from a process",
    situation: "You accepted elsewhere or the role is no longer right.",
    subject: "Withdrawing my application: [Role title]",
    body: `Hi [Name],

Thank you for your time and for considering me for the [Role title] role. After careful thought, I have decided to withdraw from the process, as [brief reason, e.g. "I have accepted another offer"].

I really enjoyed meeting the team and learning about [something specific]. I hope we can stay in touch, and I would be glad to reconnect in the future.

Best wishes,
[Your name]`,
    tips: ["Withdraw as soon as you decide. It frees the slot and keeps your reputation intact."],
  },

  // ─── Offers ────────────────────────────────────────────────────────────────
  {
    id: "offer-negotiate-salary",
    category: "offers",
    channel: "email",
    title: "Negotiating salary",
    situation: "You have an offer and want a higher base.",
    subject: "[Role title] offer",
    body: `Hi [Name],

Thank you so much for the offer. I am excited about the [Role title] role and about joining [team].

Before I sign, I wanted to discuss the base salary. Based on [market data for this role and location, my experience with X, and another offer, if you have one], I was hoping for a base closer to [target number].

I am confident I can [specific impact you will have], and I want to make this work. Is there flexibility to get closer to that number?

Thank you for considering it. I am looking forward to finding something that works for both of us.

Best,
[Your name]`,
    tips: [
      "Name a specific number slightly above what you want; it leaves room to meet in the middle.",
      "Anchor on market data and the value you'll bring, not personal expenses.",
      "Negotiating politely almost never costs an offer. Not negotiating often costs thousands.",
    ],
  },
  {
    id: "offer-negotiate-package",
    category: "offers",
    channel: "email",
    title: "Negotiating beyond salary (equity, bonus, start date)",
    situation: "Base is fixed, but other parts of the package may move.",
    subject: "Re: [Role title] offer",
    body: `Hi [Name],

Thanks for getting back to me on the base salary. I understand there is limited room there.

Would there be flexibility on any of the following instead?
- A signing bonus of [amount]
- [Additional equity, e.g. "an extra X shares or units"]
- [Start date, remote days, extra PTO, or a learning budget]

Any of these would help close the gap, and I would be ready to sign quickly.

Thank you,
[Your name]`,
    tips: ["Saying you'd be ready to sign quickly gives the recruiter a reason to push internally."],
  },
  {
    id: "offer-accept",
    category: "offers",
    channel: "email",
    title: "Accepting an offer",
    situation: "You're saying yes and want everything confirmed in writing.",
    subject: "Offer acceptance: [Role title]",
    body: `Hi [Name],

I am delighted to formally accept the offer for the [Role title] role at [Company]. Thank you to you and the team for a great process.

To confirm the details as I understand them:
- Start date: [date]
- Base salary: [amount]
- [Bonus, equity, location or other agreed terms]

Please let me know the next steps for paperwork and onboarding. I am excited to get started.

Best,
[Your name]`,
    tips: ["Restating the terms in writing catches mistakes before you sign anything."],
  },
  {
    id: "offer-decline",
    category: "offers",
    channel: "email",
    title: "Declining an offer gracefully",
    situation: "You're turning it down and want to stay on good terms.",
    subject: "[Role title] offer",
    body: `Hi [Name],

Thank you very much for the offer and for the time everyone spent with me. After a lot of thought, I have decided to decline, as [brief honest reason, e.g. "I have accepted a role that is closer to my long-term focus on X"].

This was not an easy decision. I was genuinely impressed by [specific people or work], and I hope we cross paths again.

Thank you again,
[Your name]`,
    tips: ["Decline by email and, if you were close to the hiring manager, with a short call too."],
  },
  {
    id: "offer-deadline-extension",
    category: "offers",
    channel: "email",
    title: "Asking for more time to decide",
    situation: "You need a few more days, often to hear back from another company.",
    subject: "Re: [Role title] offer timeline",
    body: `Hi [Name],

Thank you again for the offer. I am very excited about it and want to give it the careful consideration it deserves.

Would it be possible to extend the decision deadline to [new date]? [Optional: "I am wrapping up one other process and want to make a final decision with all the information."]

I really appreciate your understanding, and I will get back to you by then at the latest.

Best,
[Your name]`,
    tips: [
      "Ask for a specific date, and keep it short: a few days to a week.",
      "Being honest about another process is normal and often speeds the other company up.",
    ],
  },
  {
    id: "offer-expedite",
    category: "offers",
    channel: "email",
    title: "Asking another company to speed up (you have an offer)",
    situation: "You have an offer elsewhere but prefer this company.",
    subject: "Timeline question: [Role title]",
    body: `Hi [Name],

I wanted to let you know I have received an offer from another company, with a decision deadline of [date].

[Company] remains my first choice, and I would love to complete your process before then if at all possible. Is there any way to move the remaining steps forward?

I understand if the timeline cannot change, and I appreciate you considering it.

Thanks,
[Your name]`,
    tips: ["Only say \"first choice\" if it is true. Recruiters compare notes more than you'd think."],
  },

  // ─── Special situations ────────────────────────────────────────────────────
  {
    id: "special-career-change",
    category: "special",
    channel: "email",
    title: "Career changer reaching out",
    situation: "You're moving into a new field and need to explain the jump.",
    subject: "[Old field] to [new field]: [relevant result]",
    body: `Hi [Name],

I am moving from [old field] into [new field], and the [Role title] role at [Company] is exactly the kind of role I have been preparing for.

What carries over directly:
- [Transferable skill, with a result from your old field]
- [Second transferable skill]

What I have built to close the gap:
- [Course, certification, project or portfolio piece, with a link]

I would love to talk about how this background could be useful for [team]. Would you have 15 minutes in the next week or two?

Best,
[Your name]`,
    tips: [
      "Lead with what transfers, then show proof you've closed the gap. Don't apologise for the switch.",
      "A portfolio link does more than any sentence about being passionate.",
    ],
  },
  {
    id: "special-visa-sponsorship",
    category: "special",
    channel: "email",
    title: "International candidate asking about sponsorship",
    situation: "You need visa sponsorship and want to raise it early and clearly.",
    subject: "Question about the [Role title] role",
    body: `Hi [Name],

I am very interested in the [Role title] role and believe my experience in [skill or domain] is a strong match.

To be upfront: I am currently on [visa status, e.g. "F-1 OPT with STEM extension, authorised to work until [date]"] and would need [H-1B sponsorship or a transfer] in the future. I wanted to ask early whether [Company] sponsors for this role, so I do not waste the team's time.

If it is possible, I would love to move forward. Thank you for letting me know either way.

Best,
[Your name]`,
    tips: [
      "Being clear early saves you from losing a late-stage process over it.",
      "Check public H-1B sponsor data for the company before you reach out.",
    ],
  },
  {
    id: "special-employment-gap",
    category: "special",
    channel: "email",
    title: "Returning after a career break",
    situation: "You have a gap and want to address it confidently.",
    subject: "[Role title]: [years] years in [field], ready to return",
    body: `Hi [Name],

I am applying for the [Role title] role. I bring [X] years of experience in [field], including [strongest achievement].

From [year] to [year] I took a planned break for [reason, e.g. "caregiving" or "health"]. During that time I kept my skills current through [course, freelance work, volunteering or project], and I am now fully ready to return.

I would love to talk about how I could contribute to [team]. Would you have time for a short call?

Best,
[Your name]`,
    tips: ["One calm sentence on the gap is enough. Spend the rest of the email on what you bring."],
  },
  {
    id: "special-internship",
    category: "special",
    channel: "email",
    title: "Student asking about internships",
    situation: "You're a student targeting an internship, posted or not.",
    subject: "[Season year] [field] internship: [School] student",
    body: `Hi [Name],

I am a [year, e.g. "third-year"] [major] student at [School], and I am looking for a [season] internship in [field]. [Company]'s work on [specific project or product] is the kind of work I want to learn from.

Recently I [project, class result or previous internship achievement]. I am comfortable with [two or three relevant tools or skills].

Is [Company] planning [season] internships? If so, I would love to know the best way to apply, or who I should speak with.

Thank you,
[Your name]
[Portfolio or GitHub link]`,
    tips: [
      "Start four to six months before the season. Many programs fill early.",
      "A link to real work is your strongest asset as a student.",
    ],
  },
  {
    id: "special-new-grad",
    category: "special",
    channel: "linkedin",
    title: "New grad reaching out to a team",
    situation: "You're graduating soon and want a full-time role.",
    body: `Hi [Name],

I graduate from [School] in [month year] with a degree in [major], and I am looking for full-time [role] positions. Your team's work on [project] really stood out.

During [internship or project], I [result with a number]. I would love to learn whether your team hires new grads, and what you look for.

Thanks for any guidance,
[Your name]`,
    tips: ["Asking what they look for invites advice, which is easier to give than a job."],
  },
  {
    id: "special-recommendation-request",
    category: "special",
    channel: "email",
    title: "Asking a former manager to be a reference",
    situation: "You're in late stages and need references lined up.",
    subject: "Would you be a reference for me?",
    body: `Hi [Name],

I hope you are doing well. I am in the final stages for a [Role title] role at [Company], and I would be honoured if you would be one of my references.

The role focuses on [key responsibilities], so it would help most if you could speak to [specific project or skill you showed while working together].

If you are open to it, I will send you the job description and a short refresher on what we worked on. They will likely reach out by [timeframe].

Thank you so much,
[Your name]`,
    tips: [
      "Always ask before listing someone, and tell them what to emphasise.",
      "Send them the job description so their answers match what the employer cares about.",
    ],
  },
  {
    id: "special-startup-founder",
    category: "special",
    channel: "email",
    title: "Cold email to a startup founder",
    situation: "Small company, no recruiter: the founder is the hiring manager.",
    subject: "Helping [Company] with [specific problem]",
    body: `Hi [Founder name],

I have been following [Company] since [launch, funding news or a post they wrote]. [Specific observation about the product, and one idea for it.]

I am a [your role] who has [result relevant to an early-stage company, e.g. "shipped a product from zero to 10k users"]. Startups need people who can [what you do end to end], and that is how I like to work.

If you are building out the team, I would love to talk. I am also happy to share the idea above in more detail, either way.

Best,
[Your name]
[Portfolio or LinkedIn]`,
    tips: [
      "Founders respond to initiative. A concrete idea or a small piece of work beats a resume.",
      "Keep it short: founders read email on their phones between everything else.",
    ],
  },
];
