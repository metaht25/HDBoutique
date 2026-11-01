"""Vector/text PDF ticket at exactly 80 mm, with measured wrapping and height."""

import base64
from io import BytesIO
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

from app.modules.boutique.schemas import ReceiptRead


def receipt_pdf(receipt: ReceiptRead) -> bytes:
    sale, boutique = receipt.sale, receipt.boutique
    width, margin = 80 * mm, 4 * mm
    content_width = width - margin * 2
    normal = ParagraphStyle(
        "normal", fontName="Helvetica", fontSize=8, leading=11, spaceAfter=4
    )
    strong = ParagraphStyle("strong", parent=normal, fontName="Helvetica-Bold")
    title = ParagraphStyle("title", parent=strong, fontSize=13, leading=17, alignment=1)
    blocks: list[tuple[Paragraph, float]] = []

    def line(value: str, style: ParagraphStyle = normal) -> None:
        paragraph = Paragraph(escape(value).replace("\n", "<br/>"), style)
        _, height = paragraph.wrap(content_width, 100000)
        blocks.append((paragraph, height + 4))

    line(boutique.name or "H&D Boutique", title)
    if boutique.ready:
        line(boutique.phone_number or "")
        line(boutique.address_line or "")
    else:
        line("Datos de la boutique pendientes de completar")
    line(f"Recibo {receipt.receipt_number} · Venta {receipt.sale_number}", strong)
    line(
        sale.created_at.astimezone(ZoneInfo("America/Managua")).strftime(
            "%d/%m/%Y %I:%M %p"
        )
        if sale.created_at
        else f"{sale.sale_date} · Hora no registrada"
    )
    line(f"Cliente: {sale.customer_name or 'Identidad histórica no registrada'}")
    if sale.customer_phone:
        line(f"Teléfono: {sale.customer_phone}")
    if sale.customer_address:
        line(sale.customer_address)
    line(f"Vendedor: {sale.seller_name or 'Identidad histórica no registrada'}")
    line("PRODUCTOS", strong)
    for item in sale.items:
        line(
            f"{item.product_name or 'Producto #' + str(item.product_id)} · "
            f"{item.size_name or 'Talla no registrada'}",
            strong,
        )
        line(f"{item.quantity} × C$ {item.unit_price:,.2f} = C$ {item.subtotal:,.2f}")
    if sale.delivery_cost is not None and sale.customer_kind == "delivery":
        line(f"Delivery: C$ {sale.delivery_cost:,.2f}")
    line(f"TOTAL C$ {sale.total:,.2f}", title)
    payment = sale.payment
    assert payment is not None
    line(
        "Pago: "
        + {"cash": "Efectivo", "transfer": "Transferencia", "mixed": "Mixto"}[
            payment.method
        ]
    )
    if payment.method == "mixed":
        line(f"Efectivo aplicado: C$ {payment.cash_amount:,.2f}")
        line(f"Transferencia: C$ {payment.transfer_amount:,.2f}")
    if payment.method != "transfer":
        line(f"Efectivo recibido: C$ {payment.received_amount:,.2f}")
        line(f"Cambio: C$ {payment.change_amount:,.2f}")
    if payment.reference:
        line(f"Referencia: {payment.reference}")
    line("ANULADO" if sale.status == "voided" else "PAGADO · EMITIDO", strong)
    if sale.annulment:
        line(f"Motivo: {sale.annulment.reason}")
        line(f"Reintegro: C$ {sale.annulment.amount:,.2f}")
        if sale.annulment.method == "mixed":
            line(f"Efectivo reintegrado: C$ {sale.annulment.cash_amount:,.2f}")
            line(f"Transferencia reintegrada: C$ {sale.annulment.transfer_amount:,.2f}")
        if sale.annulment.reference:
            line(f"Referencia del reintegro: {sale.annulment.reference}")
    if sale.notes:
        line(f"Notas: {sale.notes}")
    line("Gracias por tu compra", title)
    logo_height = 22 * mm if boutique.logo_base64 else 0
    height = margin * 2 + logo_height + sum(block_height for _, block_height in blocks)
    output = BytesIO()
    canvas = Canvas(output, pagesize=(width, height), pageCompression=1)
    canvas.setTitle(receipt.receipt_number + " | H&D Boutique")
    y = height - margin
    if boutique.logo_base64:
        logo = ImageReader(BytesIO(base64.b64decode(boutique.logo_base64)))
        canvas.drawImage(
            logo,
            margin,
            y - logo_height,
            width=content_width,
            height=logo_height - 4,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )
        y -= logo_height
    for paragraph, block_height in blocks:
        y -= block_height
        paragraph.drawOn(canvas, margin, y + 4)
    canvas.showPage()
    canvas.save()
    return output.getvalue()
