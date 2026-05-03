from rest_framework import viewsets
from ventas.models import Venta, Detalleventa
from ventas.api.serializers import (
    VentaSerializer,
    DetalleventaSerializer,
)


class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer


class DetalleventaViewSet(viewsets.ModelViewSet):
    queryset = Detalleventa.objects.all()
    serializer_class = DetalleventaSerializer