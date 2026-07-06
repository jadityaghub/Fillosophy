from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit

def create_resume(path):
    c = canvas.Canvas(path, pagesize=letter)
    width, height = letter
    
    # Fonts and settings
    def draw_text(x, y, text, font="Helvetica", size=10, max_width=450):
        c.setFont(font, size)
        lines = simpleSplit(text, font, size, max_width)
        for line in lines:
            c.drawString(x, y, line)
            y -= (size + 2)
        return y
    
    y = height - 50
    
    # Header
    y = draw_text(50, y, "ALEX CARTER", "Helvetica-Bold", 18)
    y -= 5
    y = draw_text(50, y, "alex.carter.fictional@example.com | +1 (555) 019-8372 | San Francisco, CA", "Helvetica", 11)
    y -= 15
    
    c.line(50, y + 10, width - 50, y + 10)
    
    # Education
    y -= 10
    y = draw_text(50, y, "EDUCATION", "Helvetica-Bold", 14)
    y -= 5
    y = draw_text(50, y, "University of Technology, San Francisco", "Helvetica-Bold", 12)
    y = draw_text(50, y, "Bachelor of Science in Computer Science", "Helvetica-Oblique", 11)
    y = draw_text(50, y, "Graduation Year: 2024", "Helvetica", 11)
    y = draw_text(50, y, "Cumulative CGPA: 3.8 / 4.0", "Helvetica", 11)
    y -= 15
    
    # Skills
    y = draw_text(50, y, "SKILLS", "Helvetica-Bold", 14)
    y -= 5
    y = draw_text(50, y, "Languages: Python, JavaScript, TypeScript, SQL, Java, C++", "Helvetica", 11)
    y = draw_text(50, y, "Frameworks/Tools: React, Node.js, FastAPI, Docker, Git, AWS, CI/CD", "Helvetica", 11)
    y -= 15
    
    # Experience
    y = draw_text(50, y, "EXPERIENCE", "Helvetica-Bold", 14)
    y -= 5
    y = draw_text(50, y, "Software Engineering Intern | TechFlow Inc.", "Helvetica-Bold", 12)
    y = draw_text(50, y, "June 2023 - August 2023", "Helvetica-Oblique", 11)
    y = draw_text(60, y, "• Developed a scalable microservice using Python and FastAPI, handling 10k+ daily requests.", "Helvetica", 11)
    y = draw_text(60, y, "• Optimized database queries, reducing response times by 30%.", "Helvetica", 11)
    y = draw_text(60, y, "• Collaborated with cross-functional teams to integrate a new real-time notification system.", "Helvetica", 11)
    y -= 10
    
    y = draw_text(50, y, "Frontend Developer | University Web Services", "Helvetica-Bold", 12)
    y = draw_text(50, y, "January 2022 - May 2023", "Helvetica-Oblique", 11)
    y = draw_text(60, y, "• Maintained and updated the university portal using React and Redux.", "Helvetica", 11)
    y = draw_text(60, y, "• Improved web accessibility to meet WCAG 2.1 AA standards.", "Helvetica", 11)
    y -= 15
    
    # Projects
    y = draw_text(50, y, "PROJECTS", "Helvetica-Bold", 14)
    y -= 5
    y = draw_text(50, y, "AI Resume Parser", "Helvetica-Bold", 12)
    y = draw_text(60, y, "• Built an NLP-based script to extract structured entities from unstructured resumes.", "Helvetica", 11)
    y = draw_text(60, y, "• Utilized spaCy and custom regular expressions to achieve 92% extraction accuracy.", "Helvetica", 11)
    y -= 10
    
    y = draw_text(50, y, "Smart Campus Navigation App", "Helvetica-Bold", 12)
    y = draw_text(60, y, "• Developed a mobile-friendly web app assisting students in locating classrooms.", "Helvetica", 11)
    y = draw_text(60, y, "• Tech Stack: React Native, Firebase, Google Maps API.", "Helvetica", 11)
    
    c.save()

if __name__ == "__main__":
    create_resume("/Users/adityaj/Documents/Projects/Fillosophy/tests/sample_resume.pdf")
    print("Resume created successfully.")
