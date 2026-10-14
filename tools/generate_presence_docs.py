from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "output" / "pdf"
SOURCE_DIR = ROOT / "output" / "source"

PROJECT_NAME = "Presence"
PROJECT_SUBTITLE = "AI-Based Elderly Companion and Monitoring System"
SESSION = "Session 2026-27"


class NumberedCanvas:
    def __init__(self, canvas, doc_title):
        self.canvas = canvas
        self.doc_title = doc_title

    def __call__(self, canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#5B6575"))
        canvas.drawString(doc.leftMargin, 0.45 * inch, self.doc_title)
        canvas.drawRightString(A4[0] - doc.rightMargin, 0.45 * inch, f"Page {doc.page}")
        canvas.setStrokeColor(colors.HexColor("#D8DEE8"))
        canvas.line(doc.leftMargin, 0.62 * inch, A4[0] - doc.rightMargin, 0.62 * inch)
        canvas.restoreState()


class BoxDiagram(Flowable):
    def __init__(self, title, boxes, connections, width=470, height=250):
        super().__init__()
        self.title = title
        self.boxes = boxes
        self.connections = connections
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.HexColor("#1F2937"))
        c.drawString(0, self.height - 14, self.title)

        scale_x = self.width / 470
        scale_y = (self.height - 35) / 215

        rects = {}
        for key, label, x, y, w, h, fill in self.boxes:
            sx, sy, sw, sh = x * scale_x, y * scale_y, w * scale_x, h * scale_y
            rects[key] = (sx, sy, sw, sh)
            c.setFillColor(colors.HexColor(fill))
            c.setStrokeColor(colors.HexColor("#677084"))
            c.roundRect(sx, sy, sw, sh, 5, stroke=1, fill=1)
            c.setFillColor(colors.HexColor("#111827"))
            c.setFont("Helvetica-Bold", 8)
            lines = label.split("\n")
            start_y = sy + sh / 2 + (len(lines) - 1) * 5
            for i, line in enumerate(lines):
                c.drawCentredString(sx + sw / 2, start_y - i * 10, line)

        c.setStrokeColor(colors.HexColor("#374151"))
        c.setLineWidth(1)
        for start, end in self.connections:
            x1, y1 = self._edge_point(rects[start], rects[end])
            x2, y2 = self._edge_point(rects[end], rects[start])
            c.line(x1, y1, x2, y2)
            self._arrow_head(c, x1, y1, x2, y2)
        c.restoreState()

    @staticmethod
    def _edge_point(source, target):
        sx, sy, sw, sh = source
        tx, ty, tw, th = target
        scx, scy = sx + sw / 2, sy + sh / 2
        tcx, tcy = tx + tw / 2, ty + th / 2
        dx, dy = tcx - scx, tcy - scy
        if abs(dx) * sh > abs(dy) * sw:
            x = sx + (sw if dx >= 0 else 0)
            y = scy + dy * ((x - scx) / dx) if dx else scy
        else:
            y = sy + (sh if dy >= 0 else 0)
            x = scx + dx * ((y - scy) / dy) if dy else scx
        return x, y

    @staticmethod
    def _arrow_head(c, x1, y1, x2, y2):
        import math

        angle = math.atan2(y2 - y1, x2 - x1)
        size = 5
        a1 = angle + math.pi * 0.82
        a2 = angle - math.pi * 0.82
        p1 = (x2 + size * math.cos(a1), y2 + size * math.sin(a1))
        p2 = (x2 + size * math.cos(a2), y2 + size * math.sin(a2))
        c.line(x2, y2, p1[0], p1[1])
        c.line(x2, y2, p2[0], p2[1])


def styles():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=32,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#162033"),
            spaceAfter=10,
        )
    )
    base.add(
        ParagraphStyle(
            name="CoverSub",
            parent=base["Normal"],
            fontSize=14,
            leading=20,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#465166"),
            spaceAfter=26,
        )
    )
    base.add(
        ParagraphStyle(
            name="H1x",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=21,
            textColor=colors.HexColor("#172033"),
            spaceBefore=16,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="H2x",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=16,
            textColor=colors.HexColor("#283449"),
            spaceBefore=12,
            spaceAfter=6,
        )
    )
    base.add(
        ParagraphStyle(
            name="Bodyx",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=13.2,
            textColor=colors.HexColor("#1F2937"),
            alignment=TA_LEFT,
            spaceAfter=5,
        )
    )
    base.add(
        ParagraphStyle(
            name="Smallx",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=10.5,
            textColor=colors.HexColor("#4B5563"),
            spaceAfter=4,
        )
    )
    base.add(
        ParagraphStyle(
            name="Caption",
            parent=base["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#4B5563"),
            alignment=TA_CENTER,
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    return base


S = styles()


def p(text, style="Bodyx"):
    return Paragraph(text, S[style])


def h1(text):
    return Paragraph(text, S["H1x"])


def h2(text):
    return Paragraph(text, S["H2x"])


def bullets(items):
    rows = [[p("-", "Bodyx"), p(item, "Bodyx")] for item in items]
    t = Table(rows, colWidths=[0.18 * inch, 5.95 * inch], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]
        )
    )
    return t


def numbered(items):
    rows = [[p(f"{i}.", "Bodyx"), p(item, "Bodyx")] for i, item in enumerate(items, 1)]
    t = Table(rows, colWidths=[0.28 * inch, 5.85 * inch], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]
        )
    )
    return t


def table(data, widths=None):
    converted = [[p(str(cell), "Smallx") for cell in row] for row in data]
    t = Table(converted, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAF0F8")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#172033")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def cover(document_type):
    return [
        Spacer(1, 1.1 * inch),
        p(PROJECT_NAME, "CoverTitle"),
        p(PROJECT_SUBTITLE, "CoverSub"),
        Spacer(1, 0.2 * inch),
        p(document_type, "CoverTitle"),
        Spacer(1, 0.45 * inch),
        table(
            [
                ["Prepared for", "Project evaluation, design review, and implementation planning"],
                ["Prepared by", "Presence project team"],
                ["Academic session", SESSION],
                ["Version", "1.0"],
                ["Date", "22 September 2026"],
            ],
            [1.6 * inch, 4.0 * inch],
        ),
        Spacer(1, 0.35 * inch),
        p(
            "This document was prepared from the project brief and the provided SRS/SDS reference format. "
            "It specifies the Presence system as a non-clinical companion and monitoring product for elderly users and caregivers.",
            "Bodyx",
        ),
        PageBreak(),
    ]


def srs_story():
    story = []
    story.extend(cover("Software Requirements Specification"))
    story.append(h1("1. Introduction"))
    story.append(h2("1.1 Purpose"))
    story.append(
        p(
            "This Software Requirements Specification defines what the Presence system must provide for elderly users, "
            "caregivers, project evaluators, designers, developers, and testers. It focuses on externally visible behavior, "
            "system constraints, interface expectations, and quality attributes. Implementation choices are intentionally "
            "kept out of this document except where they constrain requirements."
        )
    )
    story.append(h2("1.2 Scope"))
    story.append(
        p(
            "Presence is an AI-based elderly companion and monitoring system. It offers voice-first companionship, routine "
            "reminders, distress detection, family connection, and a caregiver dashboard. The elderly user interacts mainly "
            "through a smart speaker style voice interface, while caregivers configure routines and review status through a "
            "web dashboard."
        )
    )
    story.append(
        bullets(
            [
                "Provide conversational check-ins, storytelling, devotional or calming content, and memory games.",
                "Issue medication, meal, hydration, and sleep/wake reminders and record verbal confirmations.",
                "Detect distress phrases, negative mood signals, missed confirmations, and unusual inactivity patterns.",
                "Escalate alerts to caregivers through dashboard notifications and backup channels such as SMS, push, or email.",
                "Summarize daily and weekly health-adjacent activity without claiming to replace medical care or emergency response.",
            ]
        )
    )
    story.append(h2("1.3 Definitions, Acronyms, and Abbreviations"))
    story.append(
        table(
            [
                ["Term", "Meaning"],
                ["Presence", "The proposed AI companion and monitoring software system."],
                ["Primary user", "The elderly person who interacts with Presence through voice."],
                ["Caregiver", "A family member or guardian who monitors the primary user and receives alerts."],
                ["Intent", "A structured interpretation of a spoken user request."],
                ["NLP", "Natural Language Processing used for intent, mood, and distress analysis."],
                ["STT / TTS", "Speech-to-Text and Text-to-Speech services used by the voice interface."],
                ["Adherence", "The recorded confirmation that a scheduled medicine or routine was followed."],
                ["Baseline", "The learned normal pattern of interactions for a specific primary user."],
            ],
            [1.6 * inch, 4.6 * inch],
        )
    )
    story.append(h2("1.4 Document Overview"))
    story.append(
        p(
            "Section 2 describes the overall system context, users, interfaces, constraints, and assumptions. Section 3 "
            "lists functional and non-functional requirements. Section 4 records acceptance criteria and traceability notes "
            "that can guide testing."
        )
    )

    story.append(h1("2. General Description"))
    story.append(h2("2.1 Product Perspective"))
    story.append(
        p(
            "Presence is an independent software product layered on top of commodity voice and web technologies. It is "
            "designed for households where the elderly user may not be comfortable with mobile apps, while caregivers need "
            "fast remote visibility into routines, alerts, and interaction trends."
        )
    )
    story.append(
        KeepTogether(
            [
                BoxDiagram(
                    "Figure 1: Presence Context Diagram",
                    [
                        ("elder", "Elderly\nUser", 20, 95, 80, 45, "#DDEBFF"),
                        ("voice", "Voice\nInterface", 135, 95, 90, 45, "#D8F3DC"),
                        ("backend", "Presence\nBackend", 260, 95, 95, 45, "#FDECC8"),
                        ("care", "Caregiver\nDashboard", 390, 140, 80, 45, "#E9D8FD"),
                        ("notify", "Alert\nChannels", 390, 50, 80, 45, "#FFD6D6"),
                        ("data", "Presence\nDatabase", 260, 15, 95, 45, "#E5E7EB"),
                    ],
                    [
                        ("elder", "voice"),
                        ("voice", "backend"),
                        ("backend", "care"),
                        ("backend", "notify"),
                        ("backend", "data"),
                        ("data", "backend"),
                    ],
                ),
                p(
                    "The voice layer mediates spoken interaction, the backend applies business rules and AI analysis, "
                    "the database preserves schedules and event history, and the caregiver dashboard presents status and alerts.",
                    "Caption",
                ),
            ]
        )
    )
    story.append(h2("2.2 Product Functions"))
    story.append(
        table(
            [
                ["Area", "Major functions"],
                ["Companionship", "Daily check-ins, casual conversation, devotional playback, stories, news, greetings, and memory games."],
                ["Routine support", "Medication reminders, adherence logging, missed-dose escalation, hydration reminders, meal reminders, and sleep/wake check-ins."],
                ["Safety monitoring", "Distress phrase recognition, mood classification, interaction-frequency tracking, inactivity anomaly detection, and alert de-duplication."],
                ["Family connection", "Prompts to contact family, caregiver messages, and voice-initiated call requests where supported."],
                ["Caregiver dashboard", "Live status, summaries, historical charts, schedule management, alert acknowledgement, and contact configuration."],
            ],
            [1.45 * inch, 4.75 * inch],
        )
    )
    story.append(h2("2.3 User Classes and Characteristics"))
    story.append(
        bullets(
            [
                "Elderly primary users may have limited digital literacy and should be able to use Presence without navigating a screen.",
                "Caregivers are expected to use a web dashboard, interpret alerts quickly, configure schedules, and respond to escalation messages.",
                "Administrators or project maintainers configure deployment settings, model thresholds, notification providers, and audit policies.",
            ]
        )
    )
    story.append(h2("2.4 Operating Environment"))
    story.append(
        p(
            "Presence is expected to run with a cloud-hosted backend, a relational database, a browser-based dashboard, and a "
            "voice interface mediated by a smart speaker platform or equivalent voice assistant runtime. Caregiver access is "
            "through modern desktop and mobile browsers."
        )
    )
    story.append(h2("2.5 Interfaces"))
    story.append(
        table(
            [
                ["Interface", "Requirement"],
                ["Hardware", "The voice interaction device shall provide microphone input and speaker output. No custom hardware is required in the baseline version."],
                ["Software", "The system shall integrate with a voice platform, backend services, database storage, notification services, and a web dashboard."],
                ["Communication", "All remote communication shall use HTTPS or equivalent secure transport. Real-time dashboard updates may use WebSocket or Server-Sent Events."],
                ["User interface", "The elderly user interface shall be voice-first. The caregiver interface shall be visual, responsive, and optimized for quick status review."],
            ],
            [1.35 * inch, 4.85 * inch],
        )
    )
    story.append(h2("2.6 Constraints and Assumptions"))
    story.append(
        bullets(
            [
                "Presence is a supportive, non-clinical system and shall not be represented as a medical diagnosis or emergency response replacement.",
                "Raw audio shall not be stored for routine monitoring unless the user intentionally records a family voice message.",
                "The system depends on internet connectivity, third-party voice services, and third-party notification delivery.",
                "Caregiver access shall require authentication and shall be limited to authorized user records.",
                "Every alert and acknowledgement shall be logged with timestamp, alert type, triggering signal, and delivery state.",
                "Thresholds for missed confirmations, negative sentiment, and inactivity shall be configurable to support different households.",
            ]
        )
    )

    story.append(h1("3. Specific Requirements"))
    story.append(h2("3.1 Functional Requirements"))
    reqs = [
        ["FR-01", "Daily check-in", "The system shall initiate spoken check-ins at caregiver-configured times."],
        ["FR-02", "Conversational response", "The system shall respond to common companionship intents using short, clear, and age-friendly language."],
        ["FR-03", "Content playback", "The system shall play devotional, calming, story, or news content on request or schedule where supported by content availability."],
        ["FR-04", "Memory activity", "The system shall conduct voice-based memory or trivia activities and record date, score, and completion state."],
        ["FR-05", "Medication reminder", "The system shall issue spoken medication reminders according to each configured schedule."],
        ["FR-06", "Adherence confirmation", "The system shall ask for and record verbal confirmation for scheduled medication reminders."],
        ["FR-07", "Missed-dose alert", "The system shall create an alert when no valid confirmation is received within the configured reminder window."],
        ["FR-08", "Routine reminders", "The system shall support meal, hydration, sleep, wake, appointment, birthday, and festival reminders."],
        ["FR-09", "Distress phrase detection", "The system shall detect configurable distress phrases during any supported interaction."],
        ["FR-10", "Mood analysis", "The system shall classify conversational transcripts into mood categories with a confidence score when the analysis service is available."],
        ["FR-11", "Inactivity detection", "The system shall compare interaction frequency against the user's baseline and flag configurable deviations."],
        ["FR-12", "Alert creation", "The system shall create prioritized alerts for distress signals, missed medicine, and anomalous inactivity."],
        ["FR-13", "Alert escalation", "The system shall escalate unacknowledged high-priority alerts to configured caregivers through backup channels."],
        ["FR-14", "Alert acknowledgement", "Caregivers shall be able to acknowledge alerts and record an optional response note."],
        ["FR-15", "Dashboard status", "The dashboard shall show active alerts, today's reminders, interaction count, adherence, and latest mood state."],
        ["FR-16", "Trend charts", "The dashboard shall show mood, adherence, interaction, and alert trends over 7, 14, and 30 day windows."],
        ["FR-17", "Schedule management", "Caregivers shall be able to create, edit, pause, and delete reminders and medication schedules."],
        ["FR-18", "Caregiver contacts", "Caregivers shall be able to manage escalation order, contact channels, quiet hours, and backup contacts."],
        ["FR-19", "Fallback handling", "Unrecognized utterances shall route to a fallback response and shall not terminate active reminders silently."],
        ["FR-20", "Duplicate control", "Repeated distress phrases within a configurable short window shall map to one active incident unless the previous alert is closed."],
    ]
    story.append(table([["ID", "Requirement", "Description"]] + reqs, [0.65 * inch, 1.35 * inch, 4.2 * inch]))
    story.append(h2("3.2 Non-Functional Requirements"))
    nfrs = [
        ["NFR-01", "Usability", "Voice prompts shall be brief, polite, and understandable by non-technical elderly users."],
        ["NFR-02", "Accessibility", "Dashboard visual design shall support readable contrast, large tap targets, and responsive layouts."],
        ["NFR-03", "Reliability", "Safety-relevant alerts shall be persisted before delivery is attempted and retried when delivery fails."],
        ["NFR-04", "Performance", "Routine voice responses should complete within an acceptable conversational latency target under normal network conditions."],
        ["NFR-05", "Security", "Dashboard access shall require authenticated sessions and role-based authorization."],
        ["NFR-06", "Privacy", "Routine raw audio shall not be stored. Transcripts and derived signals shall be retained only as configured."],
        ["NFR-07", "Auditability", "The system shall maintain an immutable-style event history for reminders, alerts, acknowledgements, and setting changes."],
        ["NFR-08", "Availability", "The dashboard and backend shall be designed for continuous operation with graceful degradation during external service failure."],
        ["NFR-09", "Maintainability", "The system shall separate voice handling, business rules, AI analysis, notification delivery, and dashboard concerns."],
        ["NFR-10", "Explainability", "Safety alerts shall include the triggering signal and confidence score where generated by the model."],
    ]
    story.append(table([["ID", "Attribute", "Requirement"]] + nfrs, [0.7 * inch, 1.25 * inch, 4.25 * inch]))
    story.append(h2("3.3 Data Requirements"))
    story.append(
        bullets(
            [
                "The system shall store elderly user profiles, caregiver accounts, contact preferences, reminder schedules, reminder events, interaction summaries, mood analyses, alert incidents, acknowledgements, and audit records.",
                "The system shall retain enough history to generate trend charts while supporting configurable retention limits for privacy.",
                "All timestamps shall be stored with timezone-aware values and displayed in the caregiver's configured locale.",
            ]
        )
    )
    story.append(h2("3.4 Acceptance Criteria"))
    story.append(
        numbered(
            [
                "A caregiver can configure a medication schedule and the primary user receives a spoken reminder at the scheduled time.",
                "A missed confirmation produces a visible dashboard alert and a backup notification according to escalation settings.",
                "A spoken distress phrase creates a high-priority incident with triggering text or signal and confidence metadata.",
                "The dashboard displays today's status and historical trends without exposing unauthorized user data.",
                "The system continues reminder delivery even if mood analysis is temporarily unavailable.",
            ]
        )
    )
    story.append(h1("4. Traceability Summary"))
    story.append(
        table(
            [
                ["Goal", "Covered by"],
                ["Reduce loneliness", "FR-01, FR-02, FR-03, FR-04"],
                ["Support routine adherence", "FR-05, FR-06, FR-07, FR-08"],
                ["Improve caregiver awareness", "FR-12, FR-13, FR-14, FR-15, FR-16"],
                ["Detect safety concerns", "FR-09, FR-10, FR-11, FR-20"],
                ["Protect user trust", "NFR-05, NFR-06, NFR-07, NFR-10"],
            ],
            [2.0 * inch, 4.2 * inch],
        )
    )
    return story


def sds_story():
    story = []
    story.extend(cover("Software Design Specification"))
    story.append(h1("1. Introduction"))
    story.append(h2("1.1 Purpose"))
    story.append(
        p(
            "This Software Design Specification describes how Presence can be built to satisfy the SRS. It defines the "
            "architectural style, major components, data model, user interface design, and test strategy for implementation."
        )
    )
    story.append(h2("1.2 Scope"))
    story.append(
        p(
            "The design covers the baseline voice companion, caregiver dashboard, backend orchestration, data persistence, "
            "AI analysis, alerting, and audit functions. It does not define custom hardware, clinical diagnosis workflows, "
            "or replacement emergency services."
        )
    )
    story.append(h2("1.3 Design Goals"))
    story.append(
        bullets(
            [
                "Keep the elderly user experience simple and voice-first.",
                "Make caregiver status review fast, explainable, and actionable.",
                "Isolate external services so voice, notification, and AI providers can be changed with limited impact.",
                "Persist critical events before performing unreliable network delivery.",
                "Protect privacy by storing derived signals and summaries instead of routine raw audio.",
            ]
        )
    )

    story.append(h1("2. System Architectural Design"))
    story.append(h2("2.1 High-Level Design"))
    story.append(
        KeepTogether(
            [
                BoxDiagram(
                    "Figure 2: Layered Architecture",
                    [
                        ("voice", "Voice\nClient", 20, 145, 85, 45, "#DDEBFF"),
                        ("web", "Caregiver\nWeb App", 20, 55, 85, 45, "#E9D8FD"),
                        ("api", "API Gateway /\nBackend", 145, 100, 100, 45, "#FDECC8"),
                        ("rules", "Reminder +\nAlert Engine", 285, 145, 105, 45, "#D8F3DC"),
                        ("ai", "AI / NLP\nService", 285, 55, 105, 45, "#FFE6A7"),
                        ("notify", "Notification\nAdapters", 400, 145, 70, 45, "#FFD6D6"),
                        ("db", "PostgreSQL\nDatabase", 400, 55, 70, 45, "#E5E7EB"),
                    ],
                    [
                        ("voice", "api"),
                        ("web", "api"),
                        ("api", "rules"),
                        ("api", "ai"),
                        ("rules", "notify"),
                        ("rules", "db"),
                        ("ai", "db"),
                    ],
                ),
                p(
                    "Presence follows a layered service design: clients call the backend, the backend coordinates domain "
                    "services, and all durable state is written to the database.",
                    "Caption",
                ),
            ]
        )
    )
    story.append(h2("2.2 Component Design"))
    story.append(
        table(
            [
                ["Component", "Responsibilities"],
                ["Voice Interaction Adapter", "Maps voice platform requests to application intents; formats spoken responses; handles fallback prompts."],
                ["Conversation Service", "Runs check-ins, companionship flows, memory games, story requests, and family message playback."],
                ["Reminder Service", "Stores schedules, calculates due reminders, records confirmations, and labels late or missed responses."],
                ["AI/NLP Service", "Processes transcripts for mood category, distress phrases, and confidence scores."],
                ["Alert Engine", "Creates incidents, de-duplicates repeated triggers, escalates unacknowledged alerts, and records delivery results."],
                ["Dashboard API", "Exposes authenticated endpoints for status cards, charts, schedules, contacts, and acknowledgement actions."],
                ["Notification Adapters", "Send SMS, push, email, or voice-call notifications through provider-specific APIs."],
                ["Audit Service", "Records security-sensitive and safety-sensitive events for review."],
            ],
            [1.7 * inch, 4.5 * inch],
        )
    )
    story.append(h2("2.3 Key Runtime Flows"))
    story.append(
        table(
            [
                ["Flow", "Design"],
                ["Medication confirmation", "Scheduler finds due reminder, voice adapter speaks prompt, response is parsed, reminder event is stored, and dashboard status updates."],
                ["Missed dose", "Reminder window expires, alert engine creates incident, database stores alert, dashboard displays alert, and notification adapter begins escalation."],
                ["Distress phrase", "Transcript enters AI/NLP service, keyword or model confidence crosses threshold, alert engine opens high-priority incident and notifies caregivers."],
                ["Dashboard trend", "Dashboard API queries aggregated interaction, adherence, mood, and alert records over the selected time window."],
            ],
            [1.5 * inch, 4.7 * inch],
        )
    )
    story.append(h2("2.4 Error Handling"))
    story.append(
        bullets(
            [
                "Voice fallback responses are returned when intent parsing fails.",
                "AI analysis failures are logged and do not block reminders or distress keyword processing.",
                "Notification failures are retried with exponential backoff and shown in the alert delivery record.",
                "Database writes for alerts and confirmations occur before external notifications are attempted.",
                "Duplicate distress events are merged into an existing active incident during the configured de-duplication window.",
            ]
        )
    )

    story.append(h1("3. Data Design"))
    story.append(h2("3.1 Database Overview"))
    story.append(
        p(
            "The primary datastore is a relational database because Presence requires consistent schedules, auditable events, "
            "caregiver authorization, and time-window queries. The model below is normalized around users, caregivers, schedules, "
            "interactions, AI results, and alerts."
        )
    )
    story.append(
        table(
            [
                ["Entity", "Selected fields", "Purpose"],
                ["elderly_users", "id, display_name, language, timezone, consent_state, active", "Stores primary user profile and consent context."],
                ["caregivers", "id, name, email, phone, auth_subject, role", "Stores authorized caregiver accounts."],
                ["caregiver_links", "elderly_user_id, caregiver_id, priority, permissions", "Maps caregivers to elderly users and escalation order."],
                ["reminder_schedules", "id, elderly_user_id, type, label, dosage, cron_rule, window_minutes, active", "Defines medication and routine schedules."],
                ["reminder_events", "id, schedule_id, due_at, status, confirmed_at, transcript", "Tracks due, confirmed, late, skipped, or missed reminder instances."],
                ["interactions", "id, elderly_user_id, started_at, intent, transcript_summary, duration_seconds", "Stores summarized voice interaction events."],
                ["mood_analyses", "interaction_id, mood_label, confidence, model_version", "Stores AI-derived mood and confidence output."],
                ["alerts", "id, elderly_user_id, type, priority, trigger_signal, confidence, status, opened_at", "Stores active and historical incidents."],
                ["alert_deliveries", "alert_id, caregiver_id, channel, provider_status, attempted_at", "Tracks notification delivery attempts."],
                ["audit_events", "actor_id, action, target_type, target_id, created_at", "Records setting changes, acknowledgement, and security-sensitive events."],
            ],
            [1.35 * inch, 2.55 * inch, 2.3 * inch],
        )
    )
    story.append(h2("3.2 Entity Relationship Summary"))
    story.append(
        KeepTogether(
            [
                BoxDiagram(
                    "Figure 3: Entity Relationship Summary",
                    [
                        ("user", "elderly_users", 15, 145, 90, 35, "#DDEBFF"),
                        ("link", "caregiver_links", 140, 145, 95, 35, "#E9D8FD"),
                        ("care", "caregivers", 270, 145, 90, 35, "#E9D8FD"),
                        ("sched", "reminder_schedules", 15, 75, 110, 35, "#D8F3DC"),
                        ("event", "reminder_events", 155, 75, 100, 35, "#D8F3DC"),
                        ("inter", "interactions", 15, 15, 90, 35, "#FDECC8"),
                        ("mood", "mood_analyses", 140, 15, 95, 35, "#FFE6A7"),
                        ("alert", "alerts", 295, 75, 75, 35, "#FFD6D6"),
                        ("deliver", "alert_deliveries", 390, 75, 80, 35, "#FFD6D6"),
                    ],
                    [
                        ("user", "link"),
                        ("link", "care"),
                        ("user", "sched"),
                        ("sched", "event"),
                        ("user", "inter"),
                        ("inter", "mood"),
                        ("user", "alert"),
                        ("alert", "deliver"),
                        ("care", "deliver"),
                    ],
                ),
                p("Primary relationships among users, caregivers, schedules, interactions, and alert delivery records.", "Caption"),
            ]
        )
    )
    story.append(h2("3.3 Data Retention and Privacy"))
    story.append(
        bullets(
            [
                "Routine raw audio is not stored by the Presence application.",
                "Transcripts may be summarized before storage according to retention settings.",
                "Alert trigger snippets are retained only as needed for explainability and audit.",
                "Caregiver access is scoped by caregiver_links permissions.",
                "Deletes and exports should be designed as administrative workflows for future compliance needs.",
            ]
        )
    )

    story.append(h1("4. User Interface Design"))
    story.append(h2("4.1 Voice UI"))
    story.append(
        table(
            [
                ["Situation", "Prompt behavior"],
                ["Daily check-in", "Use a warm greeting, one question at a time, and simple follow-up choices."],
                ["Medication reminder", "State medicine name and dose clearly, ask for confirmation, and repeat once if response is unclear."],
                ["Distress signal", "Acknowledge the user's concern briefly and state that the caregiver is being notified."],
                ["Fallback", "Apologize briefly, offer two examples, and return to the previous active flow when possible."],
            ],
            [1.55 * inch, 4.65 * inch],
        )
    )
    story.append(h2("4.2 Caregiver Dashboard"))
    story.append(
        bullets(
            [
                "Top status band: active alert count, last interaction, medication adherence today, and latest mood signal.",
                "Main timeline: reminders, conversations, alerts, acknowledgements, and delivery attempts in reverse chronological order.",
                "Trends view: adherence, mood, interaction frequency, and alert count with 7, 14, and 30 day filters.",
                "Settings view: schedules, contacts, escalation order, quiet hours, language, and thresholds.",
                "Alert detail view: trigger, confidence, timeline, delivery attempts, acknowledgement controls, and caregiver notes.",
            ]
        )
    )
    story.append(
        KeepTogether(
            [
                table(
                    [
                        ["Dashboard region", "Content"],
                        ["Header", "Selected elderly user, last sync, caregiver account menu"],
                        ["Status cards", "Active alerts, next medicine, adherence, latest mood"],
                        ["Alert panel", "Priority, trigger, age, escalation state, acknowledge action"],
                        ["Timeline", "Interactions, reminders, confirmations, missed events"],
                        ["Charts", "Mood, adherence, interaction frequency, alerts"],
                    ],
                    [1.7 * inch, 4.5 * inch],
                ),
                p("Figure 4: Caregiver dashboard wireframe content inventory.", "Caption"),
            ]
        )
    )

    story.append(h1("5. API and Module Design"))
    story.append(h2("5.1 Representative API Endpoints"))
    story.append(
        table(
            [
                ["Endpoint", "Method", "Purpose"],
                ["/api/users/{id}/status", "GET", "Return dashboard status summary."],
                ["/api/users/{id}/reminders", "GET/POST", "List or create reminder schedules."],
                ["/api/reminders/{id}", "PATCH/DELETE", "Edit, pause, or remove a reminder schedule."],
                ["/api/alerts", "GET", "List active or historical alerts by user and status."],
                ["/api/alerts/{id}/acknowledge", "POST", "Acknowledge an alert and store caregiver note."],
                ["/api/voice/intent", "POST", "Receive normalized voice intent payloads from the voice adapter."],
                ["/api/events/webhook/notification", "POST", "Receive provider delivery callbacks."],
            ],
            [2.15 * inch, 0.85 * inch, 3.2 * inch],
        )
    )
    story.append(h2("5.2 Security Design"))
    story.append(
        bullets(
            [
                "Use authenticated caregiver sessions with secure cookies or signed bearer tokens.",
                "Authorize every dashboard request against caregiver_links.",
                "Encrypt transport with HTTPS and keep provider credentials in environment-managed secrets.",
                "Log security-sensitive setting changes in audit_events.",
                "Apply least-privilege database access for runtime services.",
            ]
        )
    )

    story.append(h1("6. Types of Tests"))
    story.append(
        table(
            [
                ["Test type", "Examples"],
                ["Unit tests", "Reminder window calculations, escalation order, duplicate alert merging, mood threshold mapping."],
                ["API tests", "Authenticated dashboard endpoints, unauthorized access denial, alert acknowledgement, schedule validation."],
                ["Voice flow tests", "Recognized medication confirmation, unclear response fallback, distress phrase during unrelated conversation."],
                ["Integration tests", "Reminder due event to voice prompt to database update to dashboard refresh."],
                ["Failure tests", "Notification provider down, NLP service timeout, database retry, duplicate webhook callback."],
                ["Usability tests", "Elderly user can respond to prompts; caregiver can understand and acknowledge alert within target time."],
                ["Security tests", "Cross-user access prevention, expired session rejection, audit logging for settings changes."],
            ],
            [1.45 * inch, 4.75 * inch],
        )
    )
    story.append(h1("7. Implementation Notes"))
    story.append(
        bullets(
            [
                "A scheduler or queue worker should own due reminders and escalation timing so alerts are not tied to dashboard activity.",
                "The AI/NLP service is implemented as a rule-based lexicon and distress keyword baseline with Hinglish emotion scoring and negation handling (modularized for future PyTorch/HuggingFace transformer replacement).",
                "Daily activity anomaly detection implements the SRS 3.1.4.5 / 3.1.6.5 statistical baseline (Threshold = µ - k*σ) to detect significant drops in daily user interaction.",
                "Dashboard chart endpoints should return pre-aggregated series to keep the client simple and fast.",
                "Provider adapters should share a delivery interface while preserving provider-specific callback metadata.",
                "Configuration values such as thresholds, windows, and quiet hours should be stored per elderly user.",
            ]
        )
    )
    return story


def build_pdf(path, story, title):
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=0.68 * inch,
        leftMargin=0.68 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.78 * inch,
        title=title,
        author="Presence project team",
    )
    doc.build(story, onFirstPage=NumberedCanvas(None, title), onLaterPages=NumberedCanvas(None, title))


def text_from_story(story):
    def collect(item):
        if isinstance(item, Paragraph):
            return [item.getPlainText()]
        if isinstance(item, Table):
            rows = []
            for row in item._cellvalues:
                cells = []
                for cell in row:
                    if isinstance(cell, list):
                        cell_text = " ".join(
                            part.getPlainText() for part in cell if isinstance(part, Paragraph)
                        )
                    elif isinstance(cell, Paragraph):
                        cell_text = cell.getPlainText()
                    else:
                        cell_text = str(cell)
                    cells.append(cell_text)
                rows.append(" | ".join(cells))
            return rows
        if isinstance(item, BoxDiagram):
            return [f"[Diagram: {item.title}]"]
        if isinstance(item, ListFlowable):
            lines = []
            for flowable in item._flowables:
                lines.extend(collect(flowable))
            return lines
        if isinstance(item, ListItem):
            lines = []
            for flowable in item._flowables:
                lines.extend(collect(flowable))
            return [f"- {line}" for line in lines]
        if isinstance(item, KeepTogether):
            lines = []
            for flowable in item._content:
                lines.extend(collect(flowable))
            return lines
        return []

    chunks = []
    for item in story:
        chunks.extend(collect(item))
    return "\n\n".join(chunks)


def main():
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)

    docs = [
        ("presence_srs.pdf", "presence_srs_source.md", "Presence - Software Requirements Specification", srs_story()),
        ("presence_sds.pdf", "presence_sds_source.md", "Presence - Software Design Specification", sds_story()),
    ]
    for pdf_name, source_name, title, story in docs:
        (SOURCE_DIR / source_name).write_text(f"# {title}\n\n{text_from_story(story)}\n", encoding="utf-8")
        build_pdf(PDF_DIR / pdf_name, story, title)
        print(PDF_DIR / pdf_name)


if __name__ == "__main__":
    main()
