from rest_framework import viewsets
from proveedores.models import Proveedores, Ofrece, Productoproveedor
from proveedores.api.serializers import (
    ProveedoresSerializer,
    OfreceSerializer,
    ProductoproveedorSerializer,
)


class ProveedoresViewSet(viewsets.ModelViewSet):
    queryset = Proveedores.objects.all()
    serializer_class = ProveedoresSerializer


class OfreceViewSet(viewsets.ModelViewSet):
    queryset = Ofrece.objects.all()
    serializer_class = OfreceSerializer


class ProductoproveedorViewSet(viewsets.ModelViewSet):
    queryset = Productoproveedor.objects.all()
    serializer_class = ProductoproveedorSerializer