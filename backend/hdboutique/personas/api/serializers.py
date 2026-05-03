from rest_framework import serializers
from personas.models import Clientes, TipoCliente, Empleados, DeudaCliente


class ClientesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clientes
        fields = '__all__'


class TipoClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoCliente
        fields = '__all__'


class EmpleadosSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empleados
        fields = '__all__'


class DeudaClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeudaCliente
        fields = '__all__'