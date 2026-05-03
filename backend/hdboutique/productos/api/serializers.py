from rest_framework import serializers
from productos.models import Productos, Categoria, Tallas


class ProductosSerializer(serializers.ModelSerializer):
    class Meta:
        model = Productos
        fields = '__all__'


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = '__all__'


class TallasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tallas
        fields = '__all__'