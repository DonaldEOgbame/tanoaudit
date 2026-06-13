"""Payment module with planted stubs (incomplete implementations)."""


def refund(charge_id, amount):
    # PLANTED: stub/todo-stub
    # TODO: call the payment provider's refund API and record the result
    raise NotImplementedError("refund not implemented")


def reconcile(ledger):
    # PLANTED: stub/empty-function
    pass


def apply_discount(order, code):
    if code == "WELCOME10":
        return order.total * 0.9
    # PLANTED: stub/unhandled-branch
    # FIXME: handle other promo codes; currently silently returns full price
    return order.total


def charge(card, amount):
    """Charge a card. Fully implemented — must NOT be flagged as a stub."""
    token = _tokenize(card)
    return _provider.charge(token, amount)
