from rest_framework import viewsets
from ubicaciones.models import Departamento, Municipio, Direccion
from ubicaciones.api.serializers import (
    DepartamentoSerializer,
    MunicipioSerializer,
    DireccionSerializer
)

#aqui usando viewset nos permite usar los metodos http
#Get, Post, Put, Delete 

class DepartamentoViewSet(viewsets.ModelViewSet):
    queryset = Departamento.objects.all() #Trabaja con todos los registros de la tabla departamento
    serializer_class = DepartamentoSerializer #convierte esos datos a JSON usando ese serializer


class MunicipioViewSet(viewsets.ModelViewSet):
    queryset = Municipio.objects.all()
    serializer_class = MunicipioSerializer


class DireccionViewSet(viewsets.ModelViewSet):
    queryset = Direccion.objects.all()
    serializer_class = DireccionSerializer