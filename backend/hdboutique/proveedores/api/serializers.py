from rest_framework import serializers
from proveedores.models import Proveedores, Ofrece, Productoproveedor


class ProveedoresSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedores
        fields = '__all__'


class OfreceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ofrece
        fields = '__all__'


class ProductoproveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Productoproveedor
        fields = '__all__'