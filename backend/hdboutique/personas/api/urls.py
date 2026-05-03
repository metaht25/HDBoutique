from rest_framework.routers import DefaultRouter
from personas.api.views import (
    ClientesViewSet,
    TipoClienteViewSet,
    EmpleadosViewSet,
    DeudaClienteViewSet,
)

router = DefaultRouter()

router.register('clientes', ClientesViewSet, basename='clientes')
router.register('tipos-clientes', TipoClienteViewSet, basename='tipos-clientes')
router.register('empleados', EmpleadosViewSet, basename='empleados')
router.register('deudas-clientes', DeudaClienteViewSet, basename='deudas-clientes')

urlpatterns = router.urls