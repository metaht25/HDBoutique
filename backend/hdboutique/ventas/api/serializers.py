from rest_framework import serializers
from ventas.models import Venta, Detalleventa


class VentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venta
        fields = '__all__'


class DetalleventaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Detalleventa
        fields = '__all__'