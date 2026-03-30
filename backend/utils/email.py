import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from dotenv import load_dotenv

load_dotenv()

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

def send_evaluation_email(to_emails, subject, body, body_html=None, pdf_content=None, pdf_filename="acompanamiento.pdf", bcc_emails=None):
    """
    to_emails: list of strings
    pdf_content: bytes
    bcc_emails: list of strings (optional)
    """
    if not SENDER_EMAIL or not SENDER_PASSWORD:
        print("Error: SMTP credentials not configured.")
        return False

    msg = MIMEMultipart('mixed')
    msg['From'] = SENDER_EMAIL
    msg['To'] = ", ".join(to_emails)
    msg['Subject'] = subject

    # Crear el contenedor alternative para texto y html
    alternative = MIMEMultipart('alternative')
    alternative.attach(MIMEText(body, 'plain'))
    if body_html:
        alternative.attach(MIMEText(body_html, 'html'))
    
    msg.attach(alternative)

    if pdf_content:
        part = MIMEApplication(pdf_content, Name=pdf_filename)
        part['Content-Disposition'] = f'attachment; filename="{pdf_filename}"'
        msg.attach(part)

    try:
        # Usamos SMTP_SSL para el puerto 465
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            # Para BCC, enviamos a la suma de todos los destinatarios, 
            # pero el header 'To' solo contiene los directos.
            all_recipients = to_emails + (bcc_emails if bcc_emails else [])
            server.sendmail(SENDER_EMAIL, all_recipients, msg.as_string())
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
