from rest_framework import serializers
from compras.models import Compras, Detallecompra


class ComprasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Compras
        fields = '__all__'


class DetallecompraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Detallecompra
        fields = '__all__'