import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
BACKUP_RECIPIENT = os.getenv("BACKUP_RECIPIENT")

def send_email_with_attachment(subject, body, filename, content, recipient=None):
    if not SMTP_USER or not SMTP_PASSWORD:
        print("Error: SMTP credentials not set in .env")
        return False

    to_email = recipient or BACKUP_RECIPIENT
    if not to_email:
        print("Error: No recipient specified for backup email")
        return False

    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain'))

        # Add attachment
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(content.encode('utf-8') if isinstance(content, str) else content)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', f"attachment; filename= {filename}")
        msg.attach(part)

        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        text = msg.as_string()
        server.sendmail(SMTP_USER, to_email, text)
        server.quit()
        
        print(f"Email enviado correctamente a {to_email}")
        return True
    except Exception as e:
        print(f"Error al enviar email: {str(e)}")
        return False
