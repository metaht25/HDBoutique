from rest_framework import viewsets
from personas.models import Clientes, TipoCliente, Empleados, DeudaCliente
from personas.api.serializers import (
    ClientesSerializer,
    TipoClienteSerializer,
    EmpleadosSerializer,
    DeudaClienteSerializer,
)


class ClientesViewSet(viewsets.ModelViewSet):
    queryset = Clientes.objects.all()
    serializer_class = ClientesSerializer


class TipoClienteViewSet(viewsets.ModelViewSet):
    queryset = TipoCliente.objects.all()
    serializer_class = TipoClienteSerializer


class EmpleadosViewSet(viewsets.ModelViewSet):
    queryset = Empleados.objects.all()
    serializer_class = EmpleadosSerializer


class DeudaClienteViewSet(viewsets.ModelViewSet):
    queryset = DeudaCliente.objects.all()
    serializer_class = DeudaClienteSerializer